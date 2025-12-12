// backend/config/gmailClient.mjs
// Gmail Authentication Helper - Supports both Service Account (Domain-wide Delegation) and OAuth 2.0
// Provides authenticated Gmail client for Email Agent

import fs from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../lib/simpleLogger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths - can be overridden via environment variables
const SERVICE_ACCOUNT_KEY_PATH = process.env.GMAIL_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '../keys/atlas-email-agent.json');
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH || path.join(__dirname, 'token.json');

// Gmail API scopes for domain-wide delegation
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send'
];

/**
 * Get authenticated Gmail client using Service Account (Domain-wide Delegation) or OAuth 2.0
 * 
 * Priority:
 * 1. Service Account (if GMAIL_SERVICE_ACCOUNT_KEY_PATH exists or GMAIL_CLIENT_EMAIL + GMAIL_PRIVATE_KEY env vars)
 * 2. OAuth 2.0 (if credentials.json + token.json exist)
 * 
 * @param {string} delegatedUser - Email address to impersonate (for service account only)
 *                                  Defaults to GMAIL_DELEGATED_USER env var or 'info@otiumcreations.com'
 * @returns {Promise<google.gmail_v1.Gmail>} Authenticated Gmail client
 * @throws {Error} If no authentication method is configured
 */
export async function getGmailClient(delegatedUser = null) {
  // Determine which user to impersonate (for service account)
  const targetUser = delegatedUser || process.env.GMAIL_DELEGATED_USER || 'info@otiumcreations.com';

  // ✅ PRIORITY 1: Try Service Account Authentication (Domain-wide Delegation)
  try {
    // Check for service account key file or env vars
    let serviceAccountKey;
    
    // Option A: Service account JSON key file
    try {
      const keyContent = await fs.readFile(SERVICE_ACCOUNT_KEY_PATH, 'utf8');
      serviceAccountKey = JSON.parse(keyContent);
      logger.debug('[GmailClient] Found service account key file', { path: SERVICE_ACCOUNT_KEY_PATH });
    } catch (fileError) {
      // Option B: Service account from environment variables
      if (process.env.GMAIL_CLIENT_EMAIL && process.env.GMAIL_PRIVATE_KEY) {
        serviceAccountKey = {
          type: 'service_account',
          project_id: process.env.GMAIL_PROJECT_ID || 'atlas-email-agent',
          private_key_id: process.env.GMAIL_PRIVATE_KEY_ID || '',
          private_key: process.env.GMAIL_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.GMAIL_CLIENT_EMAIL,
          client_id: process.env.GMAIL_CLIENT_ID || '',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.GMAIL_CLIENT_X509_CERT_URL || ''
        };
        logger.debug('[GmailClient] Using service account from environment variables');
      } else {
        throw new Error('Service account key file not found and env vars not set');
      }
    }

    // Validate service account structure
    if (!serviceAccountKey.client_email || !serviceAccountKey.private_key) {
      throw new Error('Service account key missing client_email or private_key');
    }

    // Create JWT client for service account authentication
    const auth = new google.auth.JWT({
      email: serviceAccountKey.client_email,
      key: serviceAccountKey.private_key,
      scopes: SCOPES,
      subject: targetUser // Impersonate the delegated user
    });

    // Authenticate and get access token
    await auth.authorize();
    
    logger.info('[GmailClient] ✅ Authenticated via Service Account (Domain-wide Delegation)', {
      serviceAccount: serviceAccountKey.client_email,
      impersonating: targetUser
    });

    // Return Gmail client with service account auth
    const gmail = google.gmail({ version: 'v1', auth });
    return gmail;

  } catch (serviceAccountError) {
    // If service account fails, log and fall through to OAuth 2.0
    logger.debug('[GmailClient] Service account authentication not available, trying OAuth 2.0', {
      error: serviceAccountError.message
    });
  }

  // ✅ PRIORITY 2: Fall back to OAuth 2.0 (for backward compatibility)
  try {
    // 1) Read credentials.json
    let credentials;
    try {
      const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
      credentials = JSON.parse(credentialsContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `Gmail authentication not configured.\n` +
          `Service Account: Place atlas-email-agent.json in backend/keys/ or set GMAIL_CLIENT_EMAIL + GMAIL_PRIVATE_KEY env vars\n` +
          `OAuth 2.0: Place credentials.json in backend/config/ and run generate-gmail-token.mjs`
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
    if (token.expiry_date && token.expiry_date <= Date.now()) {
      if (token.refresh_token) {
        logger.debug('[GmailClient] Token expired, refreshing automatically...');
        try {
          const { credentials: newToken } = await oAuth2Client.refreshAccessToken();
          const updatedToken = {
            ...token,
            ...newToken,
            expiry_date: newToken.expiry_date || Date.now() + 3600000
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

    logger.debug('[GmailClient] ✅ Gmail client authenticated via OAuth 2.0');

    return gmail;

  } catch (error) {
    logger.error('[GmailClient] Failed to get Gmail client:', {
      error: error.message,
      serviceAccountPath: SERVICE_ACCOUNT_KEY_PATH,
      credentialsPath: CREDENTIALS_PATH,
      tokenPath: TOKEN_PATH
    });
    throw error;
  }
}

/**
 * Check if Gmail is configured (Service Account or OAuth 2.0)
 * @returns {Promise<boolean>} True if any authentication method is configured
 */
export async function isGmailConfigured() {
  // Check for service account key file
  try {
    await fs.access(SERVICE_ACCOUNT_KEY_PATH);
    return true;
  } catch {
    // Check for service account env vars
    if (process.env.GMAIL_CLIENT_EMAIL && process.env.GMAIL_PRIVATE_KEY) {
      return true;
    }
  }

  // Check for OAuth 2.0 credentials
  try {
    await fs.access(CREDENTIALS_PATH);
    await fs.access(TOKEN_PATH);
    return true;
  } catch {
    return false;
  }
}

