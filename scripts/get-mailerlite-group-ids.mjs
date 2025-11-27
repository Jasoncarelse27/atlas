#!/usr/bin/env node
/**
 * Get MailerLite Group IDs
 * Run this to find the group IDs needed for environment variables
 */

import 'dotenv/config';

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;

if (!MAILERLITE_API_KEY) {
  console.error('❌ MAILERLITE_API_KEY not found in environment variables');
  console.log('💡 Set it in your .env file or Railway environment variables');
  process.exit(1);
}

async function getGroupIds() {
  try {
    console.log('🔍 Fetching MailerLite groups...\n');
    
    const response = await fetch('https://api.mailerlite.com/api/v2/groups', {
      headers: {
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MailerLite API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const groups = data.data || data; // Handle different response formats
    
    if (!Array.isArray(groups) || groups.length === 0) {
      console.log('⚠️  No groups found in MailerLite');
      return;
    }

    console.log('✅ Found groups:\n');
    console.log('📋 Copy these to your Railway environment variables:\n');
    
    const groupMap = {
      'atlas_free_users': 'MAILERLITE_GROUP_FREE_ID',
      'core_subscribers': 'MAILERLITE_GROUP_CORE_ID',
      'studio_subscribers': 'MAILERLITE_GROUP_STUDIO_ID',
      'atlas_upgrade_ready': 'MAILERLITE_GROUP_UPGRADE_READY_ID',
    };

    groups.forEach(group => {
      const envVarName = groupMap[group.name] || `MAILERLITE_GROUP_${group.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_ID`;
      console.log(`${envVarName}=${group.id}  # ${group.name} (${group.subscribers_count || 0} subscribers)`);
    });

    console.log('\n💡 Add these to Railway: Settings → Variables → Add Variable');
    console.log('💡 After adding, restart your Railway service for changes to take effect\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getGroupIds();

