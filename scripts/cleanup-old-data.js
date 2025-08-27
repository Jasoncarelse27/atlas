#!/usr/bin/env node

/**
 * Data Cleanup Script for Supabase Cost Optimization
 * 
 * This script helps reduce Supabase costs by:
 * 1. Archiving old conversations
 * 2. Deleting old webhook logs
 * 3. Compressing JSONB data
 * 4. Cleaning up orphaned records
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const config = {
  // Data retention periods (in days)
  retention: {
    free: {
      webhook_logs: 90,
      conversations: 180
    },
    pro: {
      webhook_logs: 365,
      conversations: 365
    },
    pro_max: {
      webhook_logs: 730, // 2 years
      conversations: 730
    }
  },
  
  // Batch sizes for processing
  batchSize: 1000,
  
  // Dry run mode (set to false to actually delete data)
  dryRun: true
};

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class DataCleanup {
  constructor() {
    this.stats = {
      conversationsArchived: 0,
      webhookLogsDeleted: 0,
      orphanedRecordsCleaned: 0,
      storageSaved: 0
    };
  }

  async run() {
    console.log('🧹 Starting Supabase data cleanup...');
    console.log(`📊 Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    try {
      // 1. Archive old conversations
      await this.archiveOldConversations();
      
      // 2. Delete old webhook logs
      await this.deleteOldWebhookLogs();
      
      // 3. Clean up orphaned records
      await this.cleanupOrphanedRecords();
      
      // 4. Show final statistics
      this.showStats();
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  }

  async archiveOldConversations() {
    console.log('📁 Archiving old conversations...');
    
    const tiers = Object.keys(config.retention);
    
    for (const tier of tiers) {
      const retentionDays = config.retention[tier].conversations;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, title, updated_at, user_id')
        .eq('is_archived', false)
        .lt('updated_at', cutoffDate.toISOString())
        .in('user_id', 
          supabase
            .from('user_profiles')
            .select('id')
            .eq('tier', tier)
        )
        .limit(config.batchSize);
      
      if (error) {
        console.error(`❌ Error fetching ${tier} conversations:`, error);
        continue;
      }
      
      if (conversations && conversations.length > 0) {
        console.log(`  📂 Found ${conversations.length} old ${tier} conversations to archive`);
        
        if (!config.dryRun) {
          const { error: updateError } = await supabase
            .from('conversations')
            .update({ is_archived: true })
            .in('id', conversations.map(c => c.id));
          
          if (updateError) {
            console.error(`❌ Error archiving ${tier} conversations:`, updateError);
          } else {
            this.stats.conversationsArchived += conversations.length;
            console.log(`  ✅ Archived ${conversations.length} ${tier} conversations`);
          }
        } else {
          console.log(`  🔍 Would archive ${conversations.length} ${tier} conversations`);
        }
      }
    }
  }

  async deleteOldWebhookLogs() {
    console.log('🗑️  Deleting old webhook logs...');
    
    const tiers = Object.keys(config.retention);
    
    for (const tier of tiers) {
      const retentionDays = config.retention[tier].webhook_logs;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      // Get user IDs for this tier
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('tier', tier);
      
      if (usersError) {
        console.error(`❌ Error fetching ${tier} users:`, usersError);
        continue;
      }
      
      if (!users || users.length === 0) continue;
      
      const userIds = users.map(u => u.id);
      
      // Delete old webhook logs in batches
      let deletedCount = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: logs, error } = await supabase
          .from('webhook_logs')
          .select('id')
          .in('user_id', userIds)
          .lt('timestamp', cutoffDate.toISOString())
          .limit(config.batchSize);
        
        if (error) {
          console.error(`❌ Error fetching ${tier} webhook logs:`, error);
          break;
        }
        
        if (!logs || logs.length === 0) {
          hasMore = false;
          break;
        }
        
        if (!config.dryRun) {
          const { error: deleteError } = await supabase
            .from('webhook_logs')
            .delete()
            .in('id', logs.map(l => l.id));
          
          if (deleteError) {
            console.error(`❌ Error deleting ${tier} webhook logs:`, deleteError);
            break;
          }
          
          deletedCount += logs.length;
          this.stats.webhookLogsDeleted += logs.length;
        } else {
          deletedCount += logs.length;
          console.log(`  🔍 Would delete ${logs.length} ${tier} webhook logs`);
        }
        
        if (logs.length < config.batchSize) {
          hasMore = false;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`  ✅ Deleted ${deletedCount} old ${tier} webhook logs`);
      }
    }
  }

  async cleanupOrphanedRecords() {
    console.log('🧹 Cleaning up orphaned records...');
    
    // Delete webhook logs without valid conversation_id
    const { data: orphanedLogs, error: logsError } = await supabase
      .from('webhook_logs')
      .select('id')
      .is('conversation_id', null)
      .limit(config.batchSize);
    
    if (logsError) {
      console.error('❌ Error fetching orphaned logs:', logsError);
    } else if (orphanedLogs && orphanedLogs.length > 0) {
      if (!config.dryRun) {
        const { error: deleteError } = await supabase
          .from('webhook_logs')
          .delete()
          .in('id', orphanedLogs.map(l => l.id));
        
        if (deleteError) {
          console.error('❌ Error deleting orphaned logs:', deleteError);
        } else {
          this.stats.orphanedRecordsCleaned += orphanedLogs.length;
          console.log(`  ✅ Deleted ${orphanedLogs.length} orphaned webhook logs`);
        }
      } else {
        console.log(`  🔍 Would delete ${orphanedLogs.length} orphaned webhook logs`);
      }
    }
    
    // Delete conversations without valid user_id
    const { data: orphanedConversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .is('user_id', null)
      .limit(config.batchSize);
    
    if (convError) {
      console.error('❌ Error fetching orphaned conversations:', convError);
    } else if (orphanedConversations && orphanedConversations.length > 0) {
      if (!config.dryRun) {
        const { error: deleteError } = await supabase
          .from('conversations')
          .delete()
          .in('id', orphanedConversations.map(c => c.id));
        
        if (deleteError) {
          console.error('❌ Error deleting orphaned conversations:', deleteError);
        } else {
          this.stats.orphanedRecordsCleaned += orphanedConversations.length;
          console.log(`  ✅ Deleted ${orphanedConversations.length} orphaned conversations`);
        }
      } else {
        console.log(`  🔍 Would delete ${orphanedConversations.length} orphaned conversations`);
      }
    }
  }

  showStats() {
    console.log('');
    console.log('📊 Cleanup Statistics:');
    console.log('======================');
    console.log(`📁 Conversations archived: ${this.stats.conversationsArchived}`);
    console.log(`🗑️  Webhook logs deleted: ${this.stats.webhookLogsDeleted}`);
    console.log(`🧹 Orphaned records cleaned: ${this.stats.orphanedRecordsCleaned}`);
    console.log('');
    
    if (config.dryRun) {
      console.log('🔍 This was a dry run. No data was actually modified.');
      console.log('💡 To perform actual cleanup, set config.dryRun = false');
    } else {
      console.log('✅ Cleanup completed successfully!');
    }
    
    console.log('');
    console.log('💰 Expected cost savings:');
    console.log('   • Reduced storage costs through data cleanup');
    console.log('   • Improved query performance through reduced data volume');
    console.log('   • Lower bandwidth costs for data transfer');
  }
}

// Run the cleanup
async function main() {
  const cleanup = new DataCleanup();
  await cleanup.run();
}

// Handle command line arguments
if (process.argv.includes('--live')) {
  config.dryRun = false;
  console.log('⚠️  LIVE MODE: Data will be permanently deleted!');
}

if (process.argv.includes('--help')) {
  console.log(`
Supabase Data Cleanup Script

Usage:
  node cleanup-old-data.js [options]

Options:
  --live     Perform actual cleanup (default is dry run)
  --help     Show this help message

Environment Variables:
  VITE_SUPABASE_URL              Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY      Your Supabase service role key

The script will:
1. Archive old conversations based on user tier
2. Delete old webhook logs based on retention policies
3. Clean up orphaned records
4. Show cleanup statistics

Retention Policies:
- Free users: 90 days for logs, 180 days for conversations
- Pro users: 365 days for logs and conversations
- Pro Max users: 730 days for logs and conversations
`);
  process.exit(0);
}

main().catch(console.error);

