// Placeholder for FastSpring integration
export const paymentService = {
  async getCurrentTier(): Promise<string | null> {
    try {
      // 🚀 Later: call FastSpring API or webhook endpoint
      return null
    } catch (err) {
      return null
    }
  },

  promptUpgrade() {
    alert("🚀 Upgrade via FastSpring coming soon!")
  },
}