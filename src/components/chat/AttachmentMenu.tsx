import { useTierAccess } from "@/hooks/useTierAccess"
import { sendMessageWithAttachments } from "@/services/chatService"
import { imageService } from "@/services/imageService"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, File, Image, Lock, Mic } from "lucide-react"
import { useState } from "react"

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
  const { hasAccess } = useTierAccess()
  const [isProcessing, setIsProcessing] = useState(false)

  // --- Handlers ---

  const handleFileUpload = async () => {
    if (!hasAccess("file")) return alert("Upgrade required for file uploads.")
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
    if (!hasAccess("image")) return alert("Upgrade required for image uploads.")
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      setIsProcessing(true)
      try {
        const result = await imageService.uploadImage(file, userId)
        await imageService.scanImage(result.filePath, userId)
      } finally {
        setIsProcessing(false)
        onClose()
      }
    }
    input.click()
  }

  const handleCameraCapture = async () => {
    if (!hasAccess("camera")) return alert("Upgrade required for camera.")
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.capture = "environment"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      setIsProcessing(true)
      try {
        const result = await imageService.uploadImage(file, userId)
        await imageService.scanImage(result.filePath, userId)
      } finally {
        setIsProcessing(false)
        onClose()
      }
    }
    input.click()
  }

  const handleAudioRecord = async () => {
    if (!hasAccess("audio")) return alert("Upgrade required for audio.")
    alert("🎤 Audio recording coming soon!") // placeholder
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
        >
          {menuItems.map((item, index) => {
            const locked = !hasAccess(item.type as "file" | "image" | "camera" | "audio")
            return (
              <motion.button
                key={item.type} // ✅ FIXED duplicate key issue
                onClick={item.action}
                disabled={locked || isProcessing}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex items-center space-x-3 w-full px-3 py-2 rounded-xl text-sm transition ${
                  locked
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-white/10 text-white"
                }`}
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