/**
 * Global voice call state for performance optimizations
 * Used to disable heavy operations during voice calls
 */

class VoiceCallState {
  private isActive = false;
  
  setActive(active: boolean) {
    this.isActive = active;
  }
  
  getActive(): boolean {
    return this.isActive;
  }
}

export const voiceCallState = new VoiceCallState();
