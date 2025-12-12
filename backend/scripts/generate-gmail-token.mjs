#!/usr/bin/env node
// backend/scripts/generate-gmail-token.mjs
// One-time OAuth token generation script for Gmail API
// Run this script to authorize the Email Agent and generate token.json

import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths - match gmailClient.mjs
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || 
  path.join(__dirname, '..', 'config', 'credentials.json');
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH || 
  path.join(__dirname, '..', 'config', 'token.json');

// ✅ SAFETY: Gmail API scopes - must match gmailClient.mjs exactly
// Request all required scopes: readonly (fetch), modify (mark as read), send (future: send replies)
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

/**
 * Prompt user for input
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Main token generation flow
 */
async function generateToken() {
  try {
    console.log('🔐 Gmail OAuth Token Generator\n');
    console.log('This script will help you authorize the Email Agent to access your Gmail.\n');

    // 1) Read credentials.json
    console.log(`📁 Loading credentials from: ${CREDENTIALS_PATH}`);
    let credentials;
    try {
      const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
      credentials = JSON.parse(credentialsContent);
      console.log('✅ Credentials loaded successfully\n');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(`❌ Error: credentials.json not found at ${CREDENTIALS_PATH}`);
        console.error('\n📋 Setup steps:');
        console.error('1. Go to Google Cloud Console → APIs & Services → Credentials');
        console.error('2. Create OAuth 2.0 Client ID (Desktop application)');
        console.error('3. Download credentials.json');
        console.error(`4. Place it at: ${CREDENTIALS_PATH}`);
        process.exit(1);
      }
      throw error;
    }

    // Validate credentials structure
    if (!credentials.installed && !credentials.web) {
      console.error('❌ Error: Invalid credentials.json format');
      console.error('Expected "installed" (Desktop) or "web" (Web) OAuth client.');
      process.exit(1);
    }

    // Extract client ID and secret
    const clientId = credentials.installed?.client_id || credentials.web?.client_id;
    const clientSecret = credentials.installed?.client_secret || credentials.web?.client_secret;
    const redirectUri = credentials.installed?.redirect_uris?.[0] || 
                       credentials.web?.redirect_uris?.[0] || 
                       'urn:ietf:wg:oauth:2.0:oob';

    if (!clientId || !clientSecret) {
      console.error('❌ Error: credentials.json missing client_id or client_secret');
      process.exit(1);
    }

    // 2) Create OAuth2 client
    console.log('🔧 Creating OAuth2 client...');
    const oAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // 3) Generate auth URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline', // Required to get refresh_token
      scope: SCOPES,
      prompt: 'consent' // Force consent screen to ensure refresh_token
    });

    console.log('\n🌐 Authorization URL generated!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Next steps:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1. Visit this URL in your browser:');
    console.log(`\n   ${authUrl}\n`);
    console.log('2. Sign in with your Gmail account (jasonc.jpg@gmail.com)');
    console.log('3. Click "Allow" to grant access');
    console.log('4. Copy the authorization code from the browser\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 4) Get authorization code from user
    const code = await askQuestion('📝 Paste the authorization code here: ');

    if (!code || code.trim().length === 0) {
      console.error('❌ Error: Authorization code is required');
      process.exit(1);
    }

    console.log('\n🔄 Exchanging authorization code for tokens...');

    // 5) Exchange code for tokens
    let token;
    try {
      const { tokens } = await oAuth2Client.getToken(code.trim());
      token = tokens;
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error.message);
      console.error('\n💡 Common issues:');
      console.error('   - Authorization code expired (codes expire quickly)');
      console.error('   - Invalid authorization code');
      console.error('   - Code already used\n');
      console.error('Please run this script again to generate a new code.');
      process.exit(1);
    }

    if (!token.access_token) {
      console.error('❌ Error: No access token received');
      process.exit(1);
    }

    // 6) Save token.json
    console.log(`💾 Saving token to: ${TOKEN_PATH}`);
    
    // Ensure config directory exists
    const tokenDir = path.dirname(TOKEN_PATH);
    await fs.mkdir(tokenDir, { recursive: true });

    // Save token with proper formatting
    await fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2));

    console.log('✅ Token saved successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('The Email Agent can now access your Gmail.');
    console.log('Token will automatically refresh when it expires.\n');
    console.log('📝 Next steps:');
    console.log('   1. Set EMAIL_AGENT_ENABLED=true in your .env file');
    console.log('   2. Restart your backend server');
    console.log('   3. Test the Email Agent via POST /api/agents/email/fetch\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
generateToken();

