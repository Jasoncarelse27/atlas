import { X } from "lucide-react"
import { useEffect, useRef } from "react"

interface StopButtonProps {
  onPress: () => void
  isVisible?: boolean
}

export const StopButton = ({ onPress, isVisible = true }: StopButtonProps) => {
  const pulseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible || !pulseRef.current) return

    const element = pulseRef.current
    let animationId: number

    const pulse = () => {
      element.style.transform = 'scale(1.4)'
      element.style.transition = 'transform 800ms ease-in-out'
      
      setTimeout(() => {
        element.style.transform = 'scale(1)'
      }, 800)
      
      animationId = requestAnimationFrame(pulse)
    }

    pulse()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <button
      ref={pulseRef}
      onClick={onPress}
      className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg shadow-red-500/50 transition-colors duration-200"
      style={{
        boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)'
      }}
    >
      <X size={16} />
    </button>
  )
}
