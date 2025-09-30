// Placeholder for FastSpring integration
export const paymentService = {
  async getCurrentTier(): Promise<string | null> {
    try {
      // 🚀 Later: call FastSpring API or webhook endpoint
      console.log("[paymentService] Checking FastSpring… (placeholder)")
      return null
    } catch (err) {
      console.error("[paymentService] Error fetching tier:", err)
      return null
    }
  },

  promptUpgrade() {
    console.log("[paymentService] Upgrade flow triggered (placeholder)")
    alert("🚀 Upgrade via FastSpring coming soon!")
  },
}