import { useTierAccess } from "@/hooks/useTierAccess"
import { sendMessageWithAttachments } from "@/services/chatService"
import { imageService } from "@/services/imageService"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, File, Image, Lock, Mic } from "lucide-react"
import { useState } from "react"
import toast from "react-hot-toast"

interface AttachmentMenuProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
  userId: string
}

export function AttachmentMenu({
  isOpen,
  onClose,
  conversationId,
  userId,
}: AttachmentMenuProps) {
  const { hasAccess, loading } = useTierAccess()
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Essential logging only
  if (process.env.NODE_ENV === 'development') {
    console.log("[AttachmentMenu] State:", { 
      userId, 
      hasImageAccess: hasAccess("image"), 
      loading,
      isOpen 
    })
  }

  // File validation helper
  const validateFile = (file: File, maxSizeMB = 10) => {
    const maxSize = maxSizeMB * 1024 * 1024 // Convert MB to bytes
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${maxSizeMB}MB`)
      return false
    }
    
    if (file.type && !validImageTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return false
    }
    
    return true
  }

  // --- Handlers ---

  const handleFileUpload = async () => {
    if (!hasAccess("file")) {
      toast.error("Upgrade required for file uploads.")
      return
    }
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.onchange = async (e: any) => {
      const files = e.target.files
      if (!files?.length) return
      setIsProcessing(true)
      try {
        await sendMessageWithAttachments(conversationId, Array.from(files), () => {}, "Uploaded files")
      } finally {
        setIsProcessing(false)
        onClose()
      }
    }
    input.click()
  }

  const handleImageUpload = async () => {
    if (!hasAccess("image")) {
      toast.error("Upgrade required for image uploads.")
      return
    }
    
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      
      // Validate file before processing
      if (!validateFile(file)) return
      
      setIsProcessing(true)
      try {
        toast.loading("Uploading image...", { id: 'image-upload' })
        const result = await imageService.uploadImage(file, userId)
        await imageService.scanImage(result.filePath, userId)
        toast.success("Image uploaded and analyzed!", { id: 'image-upload' })
      } catch (error) {
        console.error("[AttachmentMenu] Image upload failed:", error)
        toast.error("Image upload failed. Please try again.", { id: 'image-upload' })
      } finally {
        setIsProcessing(false)
        onClose()
      }
    }
    input.click()
  }

  const handleCameraCapture = async () => {
    if (!hasAccess("camera")) {
      toast.error("Upgrade required for camera.")
      return
    }
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.capture = "environment"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      
      // Validate file before processing
      if (!validateFile(file)) return
      
      setIsProcessing(true)
      try {
        toast.loading("Processing camera capture...", { id: 'camera-upload' })
        const result = await imageService.uploadImage(file, userId)
        await imageService.scanImage(result.filePath, userId)
        toast.success("Photo captured and analyzed!", { id: 'camera-upload' })
      } catch (error) {
        console.error("[AttachmentMenu] Camera capture failed:", error)
        toast.error("Camera capture failed. Please try again.", { id: 'camera-upload' })
      } finally {
        setIsProcessing(false)
        onClose()
      }
    }
    input.click()
  }

  const handleAudioRecord = async () => {
    if (!hasAccess("audio")) {
      toast.error("Upgrade required for audio.")
      return
    }
    toast.success("🎤 Audio recording coming soon!") // placeholder
  }

  // --- Menu Items ---

  const menuItems = [
    { icon: File, label: "Attach File", action: handleFileUpload, type: "file" },
    { icon: Image, label: "Upload Image", action: handleImageUpload, type: "image" },
    { icon: Camera, label: "Take Photo", action: handleCameraCapture, type: "camera" },
    { icon: Mic, label: "Record Audio", action: handleAudioRecord, type: "audio" },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute bottom-16 left-4 w-56 bg-gray-900 border border-white/10 rounded-2xl shadow-lg p-2 z-50"
              role="menu"
              aria-label="Attachment options"
            >
          {menuItems.map((item, index) => {
            const locked = !hasAccess(item.type as "file" | "image" | "camera" | "audio")
            return (
              <motion.button
                key={`menu-${item.type}`} // ✅ FIXED duplicate key issue
                onClick={item.action}
                disabled={locked || isProcessing || loading}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex items-center space-x-3 w-full px-3 py-2 rounded-xl text-sm transition ${
                  locked || loading
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-white/10 text-white"
                }`}
                role="menuitem"
                aria-label={locked ? `${item.label} (Upgrade required)` : item.label}
                aria-disabled={locked || isProcessing || loading}
              >
                <item.icon className="w-5 h-5 text-white" />
                <span className="text-white">{item.label}</span>
                {locked && <Lock className="w-4 h-4 text-gray-400 ml-auto" />}
              </motion.button>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}