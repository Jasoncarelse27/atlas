import { useEffect, useState } from "react"

export const TypingDots = () => {
  const [dots, setDots] = useState(".")
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === "...") return "."
        return prev + "."
      })
    }, 400)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="flex items-center">
      <span 
        className="text-2xl font-bold animate-pulse" 
        style={{ 
          color: '#D3DCAB',
          textShadow: '0 0 1px #D3DCAB'
        }}
      >
        {dots}
      </span>
    </div>
  )
}
