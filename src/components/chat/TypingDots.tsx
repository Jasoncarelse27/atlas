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
    <span className="text-gray-500 text-lg animate-pulse">
      {dots}
    </span>
  )
}
