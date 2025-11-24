#!/usr/bin/env node

/**
 * Script to fetch MailerLite group IDs
 * Run with: node scripts/get-mailerlite-group-ids.js
 */

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;

if (!MAILERLITE_API_KEY) {
  console.error('❌ Error: MAILERLITE_API_KEY environment variable not set');
  console.log('\nSet it with: export MAILERLITE_API_KEY=your_api_key_here');
  process.exit(1);
}

async function fetchGroups() {
  try {
    console.log('🔍 Fetching MailerLite groups...\n');
    
    const response = await fetch('https://api.mailerlite.com/api/v2/groups', {
      headers: {
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MailerLite API error: ${response.status} - ${error}`);
    }
    
    const groups = await response.json();
    
    if (!groups || groups.length === 0) {
      console.log('No groups found in your MailerLite account.');
      console.log('\nCreate these groups in MailerLite:');
      console.log('- atlas_free_users');
      console.log('- core_subscribers');
      console.log('- studio_subscribers');
      console.log('- atlas_upgrade_ready');
      return;
    }
    
    console.log('📋 Your MailerLite Groups:\n');
    console.log('Group Name                    | Group ID');
    console.log('------------------------------|----------');
    
    groups.forEach(group => {
      console.log(`${group.name.padEnd(29)} | ${group.id}`);
    });
    
    // Look for Atlas-specific groups
    const atlasGroups = {
      'atlas_free_users': groups.find(g => g.name === 'atlas_free_users'),
      'core_subscribers': groups.find(g => g.name === 'core_subscribers'),
      'studio_subscribers': groups.find(g => g.name === 'studio_subscribers'),
      'atlas_upgrade_ready': groups.find(g => g.name === 'atlas_upgrade_ready'),
    };
    
    console.log('\n📌 Environment Variables to Add:\n');
    console.log('# Add these to your .env or Railway environment:');
    
    Object.entries(atlasGroups).forEach(([name, group]) => {
      if (group) {
        const envName = `MAILERLITE_GROUP_${name.toUpperCase().replace('_SUBSCRIBERS', '').replace('ATLAS_', '')}_ID`;
        console.log(`${envName}=${group.id}`);
      } else {
        console.log(`# ⚠️  Group "${name}" not found - create it in MailerLite first`);
      }
    });
    
    console.log('\n✅ Next Steps:');
    console.log('1. Create any missing groups in MailerLite');
    console.log('2. Add the environment variables above to Railway');
    console.log('3. Restart your backend service');
    console.log('4. Test signup to verify welcome emails are sent');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchGroups();
