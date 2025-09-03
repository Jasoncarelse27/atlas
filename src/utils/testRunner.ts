// 🧪 Test Runner Utility for Browser Console Testing
// Run this in your browser console to test the service layer

import { chatService } from '../services/chatService'
import type { Message } from '../types/chat'

// Test message factory
const createTestMessage = (content: string): Message => ({
  id: crypto.randomUUID(),
  role: 'user',
  content: {
    type: 'text',
    text: content
  },
  timestamp: new Date().toISOString(),
  status: 'pending',
})

// Quick test functions for console
export const testUtils = {
  // Test SafeMode send
  async testSafeModeSend() {
    console.log('🔒 Testing SafeMode Send...')
    try {
      const result = await chatService.sendMessage(
        createTestMessage('SafeMode test message'),
        'test-convo-' + Date.now(),
        true
      )
      console.log('✅ SafeMode Send Success:', result)
      return result
    } catch (error) {
      console.error('❌ SafeMode Send Failed:', error)
      throw error
    }
  },

  // Test Normal mode send
  async testNormalModeSend() {
    console.log('🌐 Testing Normal Mode Send...')
    try {
      const result = await chatService.sendMessage(
        createTestMessage('Normal mode test message'),
        'test-convo-' + Date.now(),
        false
      )
      console.log('✅ Normal Mode Send Success:', result)
      return result
    } catch (error) {
      console.error('❌ Normal Mode Send Failed:', error)
      throw error
    }
  },

  // Test SafeMode streaming
  async testSafeModeStream() {
    console.log('🔒 Testing SafeMode Streaming...')
    try {
      const result = await chatService.streamMessage(
        createTestMessage('Stream test in SafeMode'),
        'test-stream-' + Date.now(),
        (chunk) => console.log('🧩 Chunk:', chunk),
        true
      )
      console.log('✅ SafeMode Stream Success:', result)
      return result
    } catch (error) {
      console.error('❌ SafeMode Stream Failed:', error)
      throw error
    }
  },

  // Test Normal mode streaming
  async testNormalModeStream() {
    console.log('🌐 Testing Normal Mode Streaming...')
    try {
      const result = await chatService.streamMessage(
        createTestMessage('Stream test in Normal mode'),
        'test-stream-' + Date.now(),
        (chunk) => console.log('🧩 Chunk:', chunk),
        false
      )
      console.log('✅ Normal Mode Stream Success:', result)
      return result
    } catch (error) {
      console.error('❌ Normal Mode Stream Failed:', error)
      throw error
    }
  },

  // Run all tests
  async runAllTests() {
    console.log('🧪 Running All chatService Tests...')
    console.log('=' .repeat(50))
    
    try {
      await this.testSafeModeSend()
      await this.testNormalModeSend()
      await this.testSafeModeStream()
      await this.testNormalModeStream()
      
      console.log('=' .repeat(50))
      console.log('🎉 All tests completed successfully!')
      console.log('📱 Check Dexie DevTools for local data')
      console.log('☁️ Supabase integration ready for implementation')
      
    } catch (error) {
      console.error('❌ Test suite failed:', error)
    }
  },

  // Check Dexie data
  async checkDexieData() {
    console.log('📱 Checking Dexie Local Storage...')
    try {
      // This will work when Dexie is properly initialized
      console.log('🔍 Dexie data check - check browser DevTools > Application > IndexedDB')
      console.log('📊 Look for "AtlasLocalMessages" database')
    } catch (error) {
      console.error('❌ Dexie check failed:', error)
    }
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).testChatService = testUtils
  console.log('🧪 chatService test utilities loaded!')
  console.log('Available commands:')
  console.log('  testChatService.testSafeModeSend()')
  console.log('  testChatService.testNormalModeSend()')
  console.log('  testChatService.testSafeModeStream()')
  console.log('  testChatService.testNormalModeStream()')
  console.log('  testChatService.runAllTests()')
  console.log('  testChatService.checkDexieData()')
}

export default testUtils
