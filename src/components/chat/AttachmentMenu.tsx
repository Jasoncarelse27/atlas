import { AnimatePresence, motion } from "framer-motion";
import { Camera, FileUp, Image as ImageIcon, Mic, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTierAccess } from "../../hooks/useTierAccess";
import { canUseFeature, useFeatureService } from "../../services/featureService";
import { useMessageStore, type PendingAttachment } from "../../stores/useMessageStore";

interface AttachmentMenuProps {
  onClose: () => void;
  conversationId?: string;
  userId?: string;
  onImageUpload?: (file: File) => void;
  onSelect?: (files: File[]) => void;
}

const menuItems = [
  { label: "Add Photo", icon: ImageIcon, type: "photo" },
  { label: "Take Photo", icon: Camera, type: "camera" },
  { label: "Upload File", icon: FileUp, type: "file" },
  { label: "Start Audio", icon: Mic, type: "audio" },
];

// Framer Motion variants for staggered animation
const containerVariants = {
  open: {
    transition: {
      staggerChildren: 0.05, // 50ms between each button
      delayChildren: 0.05,
    },
  },
  closed: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  closed: { opacity: 0, y: 8 },
  open: { opacity: 1, y: 0 },
};

export default function AttachmentMenu({ onClose, onImageUpload, onSelect }: AttachmentMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const addPendingAttachments = useMessageStore((state) => state.addPendingAttachments);
  const { tier, loading } = useTierAccess();
  const { checkFeature } = useFeatureService();

  // Debug tier loading (only log when loading changes)
  useEffect(() => {
    console.log(`🔍 AttachmentMenu: tier=${tier}, loading=${loading}`);
  }, [tier, loading]);

  // ✅ Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // ✅ File pickers
  const handleImageUpload = () => {
    if (!canUseFeature(tier, "image")) {
      checkFeature("image", tier); // This will show upgrade modal
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as File[];
      if (onSelect) {
        onSelect(files);
    } else {
        // Fallback to old flow
        files.forEach(file => {
          if (file.type.startsWith('image/') && onImageUpload) {
            onImageUpload(file);
          }
        });
      }
      onClose();
    };
    input.click();
  };

  const handleFileUpload = () => {
    if (!canUseFeature(tier, "file")) {
      checkFeature("file", tier);
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx,.txt,.zip,.csv,.xlsx,.pptx";
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as File[];
      if (onSelect) {
        onSelect(files);
      } else {
        // Fallback to old flow
        files.forEach(file => {
          const tempUrl = URL.createObjectURL(file);
          const attachment: PendingAttachment = {
            id: crypto.randomUUID(),
            file,
            previewUrl: tempUrl,
            caption: "",
          };
          addPendingAttachments([attachment]);
        });
      }
      onClose();
    };
    input.click();
  };

  // ✅ Camera flow
  const handleTakePhoto = async () => {
    if (!canUseFeature(tier, "image")) {
      checkFeature("image", tier);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
          } catch (err) {
      toast.error("Camera access denied ❌");
    }
  };

  const capturePhoto = () => {
    const canvas = document.createElement("canvas");
    const video = videoRef.current;
    if (!video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        if (onSelect) {
          onSelect([file]);
        } else if (onImageUpload) {
          onImageUpload(file);
        }
        toast.success("Photo captured ✅");
        closeCamera();
      }
    }, "image/jpeg");
  };

  const closeCamera = () => {
    setShowCamera(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  };

  // ✅ Audio
  const handleStartAudio = async () => {
    if (!canUseFeature(tier, "audio")) {
      checkFeature("mic", tier); // Use "mic" for the upgrade modal
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      toast.success("Microphone permission granted ✅");
      // TODO: Integrate recorder logic here
      onClose();
    } catch (err) {
      toast.error("Microphone access denied ❌");
    }
  };

  const handleSelect = (type: string) => {
    switch (type) {
      case "photo":
        handleImageUpload();
        break;
      case "camera":
        handleTakePhoto();
        break;
      case "file":
        handleFileUpload();
        break;
      case "audio":
        handleStartAudio();
        break;
    }
  };

  return (
    <>
      {/* 📂 Main menu */}
      <AnimatePresence>
        <motion.div
      ref={menuRef}
          initial="closed"
          animate="open"
          exit="closed"
          variants={containerVariants}
          className="absolute bottom-14 left-0 bg-[#1c1f26] text-white rounded-xl shadow-lg p-2 space-y-2 z-50 min-w-max"
        >
              {menuItems.map((item) => (
                <motion.button
                  key={item.type}
                  variants={itemVariants}
                  onClick={() => handleSelect(item.type)}
                  className="flex items-center space-x-2 w-full px-3 py-2 rounded-lg text-sm text-white hover:bg-[#2a2e37] transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <item.icon size={18} className="text-[#F4E5D9]" />
                  <span>{item.label}</span>
                </motion.button>
              ))}
        </motion.div>
      </AnimatePresence>

      {/* 📸 Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative w-full max-w-md bg-[#1c1f26] rounded-lg p-4">
        <button 
                onClick={closeCamera}
                className="absolute top-2 right-2 text-white hover:text-gray-300 transition-colors"
              >
                <X size={24} />
        </button>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="rounded-md w-full h-64 object-cover"
              />
              <div className="flex gap-2 mt-4">
        <button 
                  onClick={capturePhoto}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-md transition-colors font-medium"
                >
                  📸 Capture Photo
        </button>
                  <button
                  onClick={closeCamera}
                  className="px-4 bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
        </div>
          </motion.div>
    )}
      </AnimatePresence>
    </>
  );
}