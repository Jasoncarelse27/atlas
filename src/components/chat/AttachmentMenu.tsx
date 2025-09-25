import { Camera, Image, Loader2, Mic, Square, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import toast from 'react-hot-toast';
import { useSupabaseAuth } from "../../hooks/useSupabaseAuth";
import { useTierAccess } from "../../hooks/useTierAccess";
import { db } from "../../lib/conversationStore";
import { supabase } from "../../lib/supabase";
import { chatService } from "../../services/chatService";
import { featureService } from "../../services/featureService";
import { syncPendingUploads } from "../../services/syncService";
import { uploadWithAuth } from "../../services/uploadService";
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
  const { canUseFeature, showUpgradeModal, tier, forceRefresh } = useTierAccess(user?.id);

  const [loadingFeature, setLoadingFeature] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<BlobPart[]>([]);

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
  const handleImageClick = () => {
    if (!user) {
      toast.error('Please log in to use this feature');
      onClose();
      return;
    }

    // Dev-only gate check for debugging
    console.log('[GateCheck] Image upload:', { tier, image: canUseFeature('image'), camera: canUseFeature('camera'), audio: canUseFeature('audio') });
    
    if (!canUseFeature('image')) {
      // Force refresh profile data in case of caching issue
      console.log('🔄 Forcing profile refresh due to tier mismatch...');
      forceRefresh().then(() => {
        // Wait a moment for the refresh to complete
        setTimeout(() => {
          // Check again after refresh
          if (!canUseFeature('image')) {
            toast.error('Image features are available in Core & Studio plans. Upgrade to unlock!');
            showUpgradeModal('image');
            featureService.logAttempt(user.id, 'image', tier === 'loading' ? 'free' : tier);
            onClose();
            return;
          } else {
            // If refresh worked, proceed with file selection
            console.log('✅ Tier refresh successful, proceeding with image upload');
            fileInputRef.current?.click();
            onClose();
          }
        }, 1000);
      });
      return;
    }
    
    // If tier check passes, proceed with file selection
    console.log('✅ Tier check passed, opening file selector');
    fileInputRef.current?.click();
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;

    console.log('[QUEUE] Starting image upload for', files.length, 'files');

    // 1) Create immediate preview with blob URLs
    const tempId = crypto.randomUUID();
    const blobUrls = files.map(file => URL.createObjectURL(file));
    
    // Add temporary message with blob URLs for immediate preview
    const tempMessage: Message = {
      id: tempId,
      role: 'user',
      content: blobUrls, // Array of blob URLs for immediate preview
      type: 'image',
      timestamp: new Date().toISOString(),
      status: 'uploading' // Show uploading state
    };
    
    // Use chatService as single source of truth
    console.log('[QUEUE] About to call chatService.handleFileMessage with:', tempMessage);
    await chatService.handleFileMessage(tempMessage);
    
    console.log('[QUEUE] Added temp message with blob previews:', { tempId, blobUrls });

    setLoadingFeature("image");
    try {
      if (files.length === 1) {
        toast.loading('Uploading image...');
      } else {
        toast.loading(`Uploading ${files.length} images...`);
      }
      
      const uploadPromises = files.map(async (file) => {
        // Use the new upload service
        const result = await uploadWithAuth(file, "image", user.id);
        
        return {
          file,
          result,
          uploaded: { url: result.url, contentType: file.type, size: file.size }
        };
      });

      const uploadResults = await Promise.all(uploadPromises);
      
      // Log feature attempt
      featureService.logAttempt(user.id, 'image', tier === 'loading' ? 'free' : tier);

      // 2) Replace blob URLs with remote URLs and create final message
      const remoteUrls = uploadResults.map(({ uploaded }) => uploaded.url);
      console.log('[QUEUE] Upload complete, replacing with remote URLs:', remoteUrls);

      // Update the existing message with remote URLs (replace blob URLs)
      const finalMessage: Message = {
        id: tempId, // Use same ID to replace the blob message
        role: 'user',
        content: remoteUrls, // Replace with remote URLs
        type: 'image',
        timestamp: new Date().toISOString(),
        status: 'sent' // Mark as completed
      };
      
      // Use chatService as single source of truth
      await chatService.handleFileMessage(finalMessage);

      // Note: Image analysis is handled by ChatPage.tsx when it detects the image message
      // No need for separate handleAfterUpload call - the normal message flow will handle it
      
      if (files.length === 1) {
        toast.success('Image uploaded successfully!');
      } else {
        toast.success(`${files.length} images uploaded successfully!`);
      }
    } catch (err) {
      console.error("❌ Image upload error:", err);
      toast.error('Failed to upload images');
      
      // Update message status to error
      const errorMessage: Message = {
        id: tempId,
        role: 'user',
        content: blobUrls, // Keep blob URLs but mark as error
        type: 'image',
        timestamp: new Date().toISOString(),
        status: 'error' // Mark as failed
      };
      
      // Use chatService as single source of truth
      await chatService.handleFileMessage(errorMessage);
    } finally {
      setLoadingFeature(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    <div 
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 z-50 bg-gray-900 rounded-lg shadow-lg border border-gray-700 p-2 flex flex-col min-w-[200px]"
    >
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />
      <input
        ref={uploadFileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {/* Buttons */}
      <button 
        onClick={handleImageClick} 
        className="p-3 text-white hover:bg-gray-700 rounded-lg transition-colors flex items-center space-x-3 disabled:opacity-50"
        disabled={loadingFeature !== null}
        title="Upload Image"
      >
        {loadingFeature === "image" ? (
          <Loader2 size={18} className="animate-spin text-blue-400" />
        ) : (
          <Image size={18} className="text-blue-400" />
        )}
        <span>Add Photo</span>
      </button>
      
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
  );
}