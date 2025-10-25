/**
 * Fix JSON Content Display Issue
 * 
 * This script repairs messages that have stringified JSON content like:
 * {"type":"text","text":"I notice your wow..."}
 * 
 * It parses the JSON and extracts just the text content.
 */

import Dexie from 'dexie';

// Define the database schema
class AtlasDB extends Dexie {
  constructor() {
    super('AtlasDatabase');
    this.version(1).stores({
      messages: 'id, conversationId, userId, timestamp, synced, updatedAt',
      conversations: 'id, userId, title, createdAt, updatedAt',
      syncMetadata: 'userId'
    });
  }
}

const db = new AtlasDB();

async function fixJsonMessages() {
  console.log('🔍 Scanning for messages with JSON content...');
  
  try {
    // Get all messages
    const messages = await db.messages.toArray();
    console.log(`📊 Found ${messages.length} total messages`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const message of messages) {
      if (typeof message.content === 'string') {
        // Check if content looks like JSON
        if (message.content.trim().startsWith('{') && 
            message.content.includes('"type"') && 
            message.content.includes('"text"')) {
          try {
            const parsed = JSON.parse(message.content);
            const extractedText = parsed.text || parsed.content || message.content;
            
            // Update the message with extracted text
            await db.messages.update(message.id, {
              content: extractedText
            });
            
            fixedCount++;
            console.log(`✅ Fixed message ${message.id}: "${extractedText.substring(0, 50)}..."`);
          } catch (e) {
            console.log(`⚠️ Skipped message ${message.id} (invalid JSON)`);
            skippedCount++;
          }
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed: ${fixedCount} messages`);
    console.log(`   ⚠️ Skipped: ${skippedCount} messages`);
    console.log(`   📝 Total scanned: ${messages.length} messages`);
    console.log('\n🎉 Database repair complete!');
    console.log('\n💡 Tip: Refresh your browser to see the changes.');
    
  } catch (error) {
    console.error('❌ Error fixing messages:', error);
  }
}

// Run the fix
fixJsonMessages();

