// backend/config/gmailClient.mjs
// Gmail OAuth 2.0 Client Helper
// Provides authenticated Gmail client for Email Agent

import fs from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../lib/simpleLogger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths - can be overridden via environment variables
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH || path.join(__dirname, 'token.json');

// Gmail API scopes - modify access for reading and sending emails
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

/**
 * Get authenticated Gmail client using OAuth 2.0
 * Reads credentials.json and token.json from backend/config/
 * Automatically handles token refresh if refresh_token is present
 * 
 * @returns {Promise<google.gmail_v1.Gmail>} Authenticated Gmail client
 * @throws {Error} If credentials.json or token.json are missing or invalid
 */
export async function getGmailClient() {
  try {
    // 1) Read credentials.json
    let credentials;
    try {
      const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
      credentials = JSON.parse(credentialsContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `Gmail OAuth credentials not found at ${CREDENTIALS_PATH}\n` +
          `Please place your credentials.json file from Google Cloud Console in backend/config/`
        );
      }
      throw new Error(`Failed to read credentials.json: ${error.message}`);
    }

    // Validate credentials structure
    if (!credentials.installed && !credentials.web) {
      throw new Error(
        'Invalid credentials.json format. Expected "installed" (Desktop) or "web" (Web) OAuth client.'
      );
    }

    // Extract client ID and secret (support both Desktop and Web OAuth clients)
    const clientId = credentials.installed?.client_id || credentials.web?.client_id;
    const clientSecret = credentials.installed?.client_secret || credentials.web?.client_secret;
    const redirectUri = credentials.installed?.redirect_uris?.[0] || credentials.web?.redirect_uris?.[0];

    if (!clientId || !clientSecret) {
      throw new Error('credentials.json missing client_id or client_secret');
    }

    // 2) Build OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri || 'urn:ietf:wg:oauth:2.0:oob' // Default for Desktop apps
    );

    // 3) Read token.json and set credentials
    let token;
    try {
      const tokenContent = await fs.readFile(TOKEN_PATH, 'utf8');
      token = JSON.parse(tokenContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `Gmail OAuth token not found at ${TOKEN_PATH}\n` +
          `Please run: node backend/scripts/generate-gmail-token.mjs\n` +
          `This will generate token.json after you authorize the app.`
        );
      }
      throw new Error(`Failed to read token.json: ${error.message}`);
    }

    // Set credentials on OAuth2 client
    oAuth2Client.setCredentials(token);

    // 4) Handle automatic token refresh
    // googleapis library automatically refreshes tokens if refresh_token is present
    // But we can add explicit refresh logic if token is expired
    if (token.expiry_date && token.expiry_date <= Date.now()) {
      if (token.refresh_token) {
        logger.debug('[GmailClient] Token expired, refreshing automatically...');
        try {
          const { credentials: newToken } = await oAuth2Client.refreshAccessToken();
          // Update token.json with new token
          const updatedToken = {
            ...token,
            ...newToken,
            expiry_date: newToken.expiry_date || Date.now() + 3600000 // Default 1 hour
          };
          await fs.writeFile(TOKEN_PATH, JSON.stringify(updatedToken, null, 2));
          logger.debug('[GmailClient] Token refreshed and saved');
        } catch (refreshError) {
          logger.error('[GmailClient] Token refresh failed:', refreshError);
          throw new Error(
            `Token expired and refresh failed: ${refreshError.message}\n` +
            `Please run: node backend/scripts/generate-gmail-token.mjs to re-authorize.`
          );
        }
      } else {
        throw new Error(
          'Token expired and no refresh_token available.\n' +
          'Please run: node backend/scripts/generate-gmail-token.mjs to re-authorize.'
        );
      }
    }

    // 5) Return authenticated Gmail client
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    logger.debug('[GmailClient] ✅ Gmail client authenticated successfully');

    return gmail;

  } catch (error) {
    logger.error('[GmailClient] Failed to get Gmail client:', {
      error: error.message,
      credentialsPath: CREDENTIALS_PATH,
      tokenPath: TOKEN_PATH
    });
    throw error;
  }
}

/**
 * Check if Gmail OAuth is configured
 * @returns {Promise<boolean>} True if credentials.json and token.json exist
 */
export async function isGmailConfigured() {
  try {
    await fs.access(CREDENTIALS_PATH);
    await fs.access(TOKEN_PATH);
    return true;
  } catch {
    return false;
  }
}

