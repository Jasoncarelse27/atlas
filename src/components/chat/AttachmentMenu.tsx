import { Camera, Image, Loader2, Mic, Square, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import toast from 'react-hot-toast';
import { v4 as uuid } from 'uuid';
import { useSupabaseAuth } from "../../hooks/useSupabaseAuth";
import { useTierAccess } from "../../hooks/useTierAccess";
import { db } from "../../lib/conversationStore";
import { supabase } from "../../lib/supabase";
import { featureService } from "../../services/featureService";
import { syncPendingUploads } from "../../services/syncService";
import { uploadImageWithProgress, uploadWithAuth } from "../../services/uploadService";
import { useMessageStore } from "../../stores/useMessageStore";
import type { Message } from '../../types/chat';

interface AttachmentMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
}

export default function AttachmentMenu({ anchorRef, onClose }: AttachmentMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useSupabaseAuth();
  const { canUseFeature, showUpgradeModal, tier } = useTierAccess(user?.id);

  const [loadingFeature, setLoadingFeature] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<BlobPart[]>([]);
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});

  // Add manual event listener for file input
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const handleChange = (e: Event) => {
      console.log("[DEBUG] Manual event listener triggered!");
      const target = e.target as HTMLInputElement;
      console.log("[DEBUG] Manual listener files:", target.files);
      if (target.files && target.files.length > 0) {
        handleImageUpload(e as any);
      }
    };

    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, []);

  // Handle file selection with instant preview
  // Helper function to sanitize filenames for Supabase Storage
  const sanitizeFileName = (fileName: string): string => {
    return fileName
      .replace(/\s+/g, "_")         // replace spaces with underscores
      .replace(/[()]/g, "")         // remove parentheses
      .replace(/[^a-zA-Z0-9._-]/g, ""); // remove other unsafe chars
  };

  const handleMultipleFileSelect = async (files: FileList) => {
    if (!files || files.length === 0) return;
    if (!user?.id) return;

    const id = uuid();
    const timestamp = new Date().toISOString();

    // Create blob previews for all files
    const attachments = Array.from(files).map((file) => {
      const blobUrl = URL.createObjectURL(file);
      let type: "image" | "audio" | "file" = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("audio/")) type = "audio";
      return { 
        type, 
        url: blobUrl, 
        progress: 0,
        file // Store original file for retry
      };
    });

    // Create message with multiple attachments
    const message: Message = {
      id,
      role: "user" as const,
      type: "mixed",
      attachments,
      status: "uploading",
      timestamp,
    };

    console.log('[DEBUG] Adding multi-attachment message to store:', message);
    useMessageStore.getState().addMessage(message);

    try {
      const uploaded: typeof attachments = [];
      
      for (const [i, file] of Array.from(files).entries()) {
        const safeName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        
        try {
          // Upload to Supabase with progress tracking
          const { data, error } = await supabase.storage
            .from("uploads")
            .upload(`${id}/${safeName}`, file, {
              cacheControl: "3600",
              upsert: true,
            });

          if (error) throw error;

          const publicUrl = supabase.storage
            .from("uploads")
            .getPublicUrl(data.path).data.publicUrl;

          uploaded.push({ 
            type: attachments[i].type, 
            url: publicUrl, 
            progress: 100,
            file: attachments[i].file
          } as any);

          // Update progress for this specific attachment
          const state = useMessageStore.getState();
          const msg = state.messages.find((m) => m.id === id);
          if (msg && msg.attachments) {
            const updated = [...msg.attachments];
            updated[i] = { ...updated[i], progress: 100, url: publicUrl };
            state.updateMessage(id, { attachments: updated });
          }
        } catch (err) {
          console.error(`[AttachmentMenu] Upload failed for file ${i}:`, err);
          
          // Mark this attachment as failed
          const state = useMessageStore.getState();
          const msg = state.messages.find((m) => m.id === id);
          if (msg && msg.attachments) {
            const updated = [...msg.attachments];
            updated[i] = { ...updated[i], failed: true, progress: 0 };
            state.updateMessage(id, { attachments: updated, status: "failed" });
          }
        }
      }

      // Update final state
      const hasFailures = uploaded.some(att => (att as any).failed);
      useMessageStore.getState().updateMessage(id, {
        status: hasFailures ? "failed" : "sent",
        attachments: uploaded,
      });

      // Send to AI if all uploads succeeded
      if (!hasFailures) {
        const { chatService } = await import('../../services/chatService');
        const finalMessage = useMessageStore.getState().messages.find(m => m.id === id);
        if (finalMessage) {
          console.log('[DEBUG] Sending multi-attachment message to Atlas AI');
          await chatService.handleFileMessage(finalMessage);
        }
      }
    } catch (err) {
      console.error("[AttachmentMenu] Multi-file upload failed", err);
      useMessageStore.getState().updateMessage(id, { status: "failed" });
    }
  };

  // Legacy single file handler for backward compatibility
  const handleFileSelect = async (file: File) => {
    console.log("[DEBUG] ENTERED handleFileSelect with file:", {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      hasFile: !!file,
    });
    
    if (!file || !user?.id) {
      console.warn("[WARN] handleFileSelect called with invalid file or no user");
      return;
    }

    // For single files, show caption modal
    setPendingFiles([file]);
    setShowCaptionModal(true);
  };

  // Process files with captions
  const processFilesWithCaptions = async () => {
    if (!user?.id || pendingFiles.length === 0) return;

    const file = pendingFiles[0]; // For single file
    const caption = captions[file.name] || "";
    
    try {
      const safeFileName = sanitizeFileName(file.name);
      const id = uuid();
      const blobUrl = URL.createObjectURL(file);

      // Create message object with all required fields
      const message: Message = {
        id,
        type: "image",
        role: "user" as const,
        content: blobUrl,
        timestamp: new Date().toISOString(),
        status: "uploading",
        localUrl: blobUrl,
        uploading: true,
        progress: 0,
        localFile: file,
        metadata: { 
          file,
          caption // Add caption to metadata
        }
      };

      console.log('[DEBUG] Adding image message to store:', message);
      useMessageStore.getState().addMessage(message);

      // Start upload with progress tracking
      await uploadImageWithProgress(file, id, {
        onProgress: (progress) => {
          useMessageStore.getState().updateMessage(id, { 
            progress,
            metadata: {
              ...useMessageStore.getState().messages.find(m => m.id === id)?.metadata,
              uploading: true,
              localPreview: blobUrl,
              uploadProgress: progress
            }
          });
        },
        onSuccess: async (publicUrl) => {
          const updatedMessage = {
            content: publicUrl,
            metadata: {
              url: publicUrl,
              imageUrl: publicUrl,
              fileName: safeFileName,
              mimeType: file.type,
              size: file.size,
              uploading: false,
              uploadProgress: 100,
              uploadError: false,
              localPreview: undefined,
              caption, // Include caption in final metadata
            },
            status: "done" as const,
            uploading: false,
            progress: 100,
            localFile: undefined,
          };
          
          useMessageStore.getState().updateMessage(id, updatedMessage);
          
          // Send image to Atlas AI for analysis
          const { chatService } = await import('../../services/chatService');
          const finalMessage = useMessageStore.getState().messages.find(m => m.id === id);
          if (finalMessage) {
            console.log('[DEBUG] Sending image to Atlas AI for analysis:', publicUrl);
            await chatService.handleFileMessage(finalMessage);
          }
        },
        onError: (err) => {
          console.error(`[ERROR] Upload failed for ${id}:`, err);
          useMessageStore.getState().updateMessage(id, {
            status: "error",
            error: err.message || "Upload failed",
            uploading: false,
            metadata: {
              ...useMessageStore.getState().messages.find(m => m.id === id)?.metadata,
              uploading: false,
              uploadError: true,
              localPreview: blobUrl,
            }
          });
        }
      });

    } catch (err) {
      console.error('[ERROR] processFilesWithCaptions failed:', err);
    } finally {
      // Clean up
      setShowCaptionModal(false);
      setPendingFiles([]);
      setCaptions({});
    }
  };


  // Pick a supported mime type for audio recording
  const pickMimeType = () => {
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",            // Safari fallback (no Opus)
      "audio/mpeg"            // final fallback if supported
    ];
    return preferredTypes.find(t => (window as any).MediaRecorder?.isTypeSupported?.(t)) ?? "";
  };


  // Helper function to handle uploads and previews
  async function handleAfterUpload({
    userId,
    feature,          // 'image' | 'camera' | 'audio' | 'file'
    uploaded,         // { url, contentType?, size? }
    conversationId,   // if you track one
  }: {
    userId: string;
    feature: 'image'|'camera'|'audio'|'file';
    uploaded: { url: string; contentType?: string; size?: number };
    conversationId?: string | null;
  }) {
    // Note: Message creation is now handled by the upload flow above
    // This function only handles backend ingestion

    // 2) Ingest record for Atlas Brain
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await fetch(`${backendUrl}/api/ingest`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          userId,
          conversationId: conversationId ?? null,
          feature,
          url: uploaded.url,
          contentType: uploaded.contentType ?? null,
          size: uploaded.size ?? null
        })
      });
      console.log("✅ File ingested for Atlas Brain processing");
    } catch (e) {
      console.warn("[Ingest] failed (will still show preview):", e);
    }
  }

  // Handle click outside and escape key to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside both the menu and the anchor button
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add event listeners with capture to ensure they fire first
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscapeKey);

    // Cleanup event listeners when component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose, anchorRef]);


  // ---- IMAGE UPLOAD ----
  // const handleImageClick = () => {
  //   if (!user) {
  //     toast.error('Please log in to use this feature');
  //     onClose();
  //     return;
  //   }

  //   // Dev-only gate check for debugging
  //   console.log('[GateCheck] Image upload:', { tier, image: canUseFeature('image'), camera: canUseFeature('camera'), audio: canUseFeature('audio') });
  //   
  //   if (!canUseFeature('image')) {
  //     // Force refresh profile data in case of caching issue
  //     console.log('🔄 Forcing profile refresh due to tier mismatch...');
  //     forceRefresh().then(() => {
  //       // Wait a moment for the refresh to complete
  //       setTimeout(() => {
  //         // Check again after refresh
  //         if (!canUseFeature('image')) {
  //           toast.error('Image features are available in Core & Studio plans. Upgrade to unlock!');
  //           showUpgradeModal('image');
  //           featureService.logAttempt(user.id, 'image', tier === 'loading' ? 'free' : tier);
  //           onClose();
  //           return;
  //         } else {
  //           // If refresh worked, proceed with file selection
  //           console.log('✅ Tier refresh successful, proceeding with image upload');
  //           console.log('[DEBUG] fileInputRef.current:', fileInputRef.current);
  //           fileInputRef.current?.click();
  //           onClose();
  //         }
  //       }, 1000);
  //     });
  //     return;
  //   }
  //   
  //   // If tier check passes, proceed with file selection
  //   console.log('✅ Tier check passed, opening file selector');
  //   console.log('[DEBUG] fileInputRef.current:', fileInputRef.current);
  //   
  //   // Reset the file input to ensure onChange fires even for the same file
  //   if (fileInputRef.current) {
  //     fileInputRef.current.value = "";
  //     // Small delay to ensure the reset takes effect
  //     setTimeout(() => {
  //       console.log('[DEBUG] About to click file input');
  //       fileInputRef.current?.click();
  //       console.log('[DEBUG] File input clicked');
  //       onClose();
  //     }, 10);
  //   } else {
  //     onClose();
  //   }
  // };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DEBUG] handleImageUpload triggered with files:', e.target.files);
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.warn('[DEBUG] handleImageUpload: no files selected');
      return;
    }

    // Use multi-file handler for multiple files, legacy handler for single file
    if (files.length > 1) {
      console.log('[DEBUG] Multiple files detected, using multi-file handler');
      handleMultipleFileSelect(files);
    } else {
      console.log('[DEBUG] Single file detected, using legacy handler');
      handleFileSelect(files[0]);
    }

    // Reset the input to ensure onChange fires even for the same file
    e.target.value = "";

    // Log feature attempt
    if (user) {
      featureService.logAttempt(user.id, 'image', tier === 'loading' ? 'free' : tier);
    }
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ---- CAMERA CAPTURE ----
  const handleCameraClick = async () => {
    if (!user) {
      toast.error('Please log in to use this feature');
      onClose();
      return;
    }

    // Dev-only gate check for debugging
    console.log('[GateCheck] Camera:', { tier, image: canUseFeature('image'), camera: canUseFeature('camera'), audio: canUseFeature('audio') });
    
    if (!canUseFeature('camera')) {
      toast.error('Camera features are available in Studio plans only. Upgrade to unlock!');
      showUpgradeModal('camera');
      featureService.logAttempt(user.id, 'camera', tier === 'loading' ? 'free' : tier);
      onClose();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.8); z-index: 9999;
      `;
      modal.appendChild(video);

      const button = document.createElement("button");
      button.innerText = "Capture";
      button.style.cssText = `
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
        padding: 10px 20px; background: #3b82f6; color: white; border: none;
        border-radius: 8px; cursor: pointer; font-size: 16px;
      `;
      button.onclick = async () => {
        setLoadingFeature("camera");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
          if (!blob) return;
          
          try {
            toast.loading('Uploading photo...');
            
            // Use the new upload service
            const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
            const result = await uploadWithAuth(file, "camera", user.id);
            
            // Log feature attempt
            featureService.logAttempt(user.id, 'camera', tier === 'loading' ? 'free' : tier);

            // Handle preview and ingestion
            await handleAfterUpload({
              userId: user.id,
              feature: "camera",
              uploaded: { url: result.url, contentType: "image/jpeg", size: blob.size },
              conversationId: null // TODO: get current conversation ID
            });
            toast.success('Photo uploaded successfully!');
          } catch (err) {
            console.error("❌ Camera upload error:", err);
            toast.error('Failed to upload photo');
          } finally {
            setLoadingFeature(null);
          }
        });

        stream.getTracks().forEach((t) => t.stop());
        document.body.removeChild(modal);
      };

      modal.appendChild(button);
      document.body.appendChild(modal);
    } catch {
      console.warn("❌ Camera access denied");
      toast.error('Camera access denied. Please allow camera permissions.');
    }
  };

  // ---- FILE UPLOAD ----
  const handleFileClick = () => {
    if (!user) {
      toast.error('Please log in to use this feature');
      onClose();
      return;
    }

    if (!canUseFeature('file')) {
      toast.error('File upload features are available in Core & Studio plans. Upgrade to unlock!');
      showUpgradeModal('file');
      featureService.logAttempt(user.id, 'photo', tier === 'loading' ? 'free' : tier);
      onClose();
      return;
    }
    uploadFileInputRef.current?.click();
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoadingFeature("file");
    try {
      toast.loading('Uploading file...');
      
      // Use the new upload service
      const result = await uploadWithAuth(file, "file", user.id);
      
      // Log feature attempt
      featureService.logAttempt(user.id, 'photo', tier === 'loading' ? 'free' : tier);

      // Determine feature type for ingestion
      const kindGuess = file.type.startsWith("audio/") ? "audio" : "file";
      
      // Handle preview and ingestion
      await handleAfterUpload({
        userId: user.id,
        feature: kindGuess,
        uploaded: { url: result.url, contentType: file.type, size: file.size },
        conversationId: null // TODO: get current conversation ID
      });
      
      toast.success('File uploaded successfully!');
    } catch (err) {
      console.error("❌ File upload error:", err);
      toast.error('Failed to upload file');
    } finally {
      setLoadingFeature(null);
      if (uploadFileInputRef.current) {
        uploadFileInputRef.current.value = '';
      }
    }
  };

  // ---- AUDIO RECORDING ----
  const startRecording = async () => {
    if (!user) {
      toast.error('Please log in to use this feature');
      onClose();
      return;
    }

    if (!canUseFeature('audio')) {
      toast.error('Audio recording features are available in Core & Studio plans. Upgrade to unlock!');
      showUpgradeModal('audio');
      featureService.logAttempt(user.id, 'audio', tier === 'loading' ? 'free' : tier);
      onClose();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start();
      
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      toast.success('Recording started...');
    } catch (err) {
      console.error("❌ Audio access denied:", err);
      toast.error('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecordingAndSave = async () => {
    if (!mediaRecorder || !user) return;

    const done = new Promise<Blob>((resolve) => {
      mediaRecorder!.onstop = () => {
        const mimeType = mediaRecorder!.mimeType || "audio/webm";
        resolve(new Blob(audioChunks, { type: mimeType }));
        mediaRecorder!.stream.getTracks().forEach(t => t.stop());
        setMediaRecorder(null);
        setAudioChunks([]);
        setIsRecording(false);
      };
    });

    mediaRecorder.stop();
    const blob = await done;

    const fileName = `recording-${Date.now()}.${blob.type.includes("mp4") ? "m4a" : "webm"}`;
    
    try {
      // Store in Dexie for offline-first approach
      await db.pendingUploads.add({
        userId: user.id,
        conversationId: null, // TODO: get current conversation ID
        feature: "attachments",
        type: "audio",
        fileName,
        contentType: blob.type,
        blob,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Log feature attempt
      featureService.logAttempt(user.id, 'audio', tier === 'loading' ? 'free' : tier);

      // Try immediate sync; if offline, cron/edge will retry
      syncPendingUploads().catch(() => {});
      
      toast.success('Audio recorded and queued for upload!');
    } catch (err) {
      console.error("❌ Failed to save audio recording:", err);
      toast.error('Failed to save audio recording');
    }
  };

  return (
    <>
    <div 
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 z-50 bg-gray-900 rounded-lg shadow-lg border border-gray-700 p-2 flex flex-col min-w-[200px]"
    >
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          console.log("[DEBUG] onChange event fired!");
          console.log("[DEBUG] handleImageUpload triggered with files:", e.target.files);
          handleImageUpload(e);
          e.target.value = ""; // allow same file selection again
        }}
      />
      
      <input
        ref={uploadFileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          console.log("[DEBUG] handleFileUpload triggered with files:", e.target.files);
          handleFileUpload(e);
          e.target.value = "";
        }}
      />

      {/* Buttons */}
      <label className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50 cursor-pointer">
        {loadingFeature === "image" ? (
          <Loader2 size={18} className="animate-spin text-blue-400" />
        ) : (
          <Image size={18} className="text-blue-400" />
        )}
        <span>Add Photo</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
          disabled={loadingFeature !== null}
        />
      </label>
      
      
      <button 
        onClick={handleCameraClick} 
        className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
        disabled={loadingFeature !== null}
        title="Take Photo"
      >
        {loadingFeature === "camera" ? (
          <Loader2 size={18} className="animate-spin text-green-400" />
        ) : (
          <Camera size={18} className="text-green-400" />
        )}
        <span>Take Photo</span>
      </button>
      
      <button 
        onClick={handleFileClick} 
        className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
        disabled={loadingFeature !== null}
        title="Upload File"
      >
        {loadingFeature === "file" ? (
          <Loader2 size={18} className="animate-spin text-purple-400" />
        ) : (
          <Upload size={18} className="text-purple-400" />
        )}
        <span>Upload File</span>
      </button>
      
      {!isRecording ? (
        <button 
          onClick={startRecording} 
          className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
          disabled={loadingFeature !== null}
          title="Start Audio Recording"
        >
          <Mic size={18} className="text-orange-400" />
          <span>Start Audio</span>
        </button>
      ) : (
        <button 
          onClick={stopRecordingAndSave} 
          className="p-3 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
          disabled={loadingFeature !== null}
          title="Stop Recording & Save"
        >
          <Square size={18} className="text-white" />
          <span>Stop & Save</span>
        </button>
      )}
    </div>

          {/* Caption Modal */}
          {showCaptionModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div 
                className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
          <h3 className="text-lg font-semibold text-white mb-4">
            Add Captions
          </h3>
          
          <div className="space-y-4">
            {pendingFiles.map((file) => (
              <div key={file.name} className="space-y-2">
                <div className="text-sm text-gray-300">
                  {file.name} ({file.type.startsWith('image/') ? 'Image' : 'Audio'})
                </div>
                <textarea
                  value={captions[file.name] || ''}
                  onChange={(e) => setCaptions(prev => ({
                    ...prev,
                    [file.name]: e.target.value
                  }))}
                  placeholder={`Add a caption for ${file.name}...`}
                  className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
            ))}
          </div>
          
                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCaptionModal(false);
                      setPendingFiles([]);
                      setCaptions({});
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      processFilesWithCaptions();
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Upload
                  </button>
                </div>
        </div>
      </div>
    )}
    </>
  );
}