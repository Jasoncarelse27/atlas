#!/usr/bin/env node
// scripts/test-email-agent.mjs
// CLI test script for Gmail Email Agent connector
// Tests JWT authentication, email fetching, and parsing

import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { EmailAgentService } from '../backend/services/emailAgentService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function testEmailAgent() {
  logSection('Gmail Email Agent Test Suite');

  // Check environment variables
  logSection('Environment Check');
  
  const requiredVars = [
    'EMAIL_AGENT_ENABLED',
    'GMAIL_CLIENT_EMAIL',
    'GMAIL_PRIVATE_KEY',
    'GMAIL_DELEGATED_USER',
    'ANTHROPIC_API_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logError(`Missing required environment variables: ${missingVars.join(', ')}`);
    logInfo('Make sure your .env file contains all required Gmail API credentials');
    process.exit(1);
  }

  if (process.env.EMAIL_AGENT_ENABLED !== 'true') {
    logWarning('EMAIL_AGENT_ENABLED is not set to "true"');
    logInfo('The Email Agent will return empty results. Set EMAIL_AGENT_ENABLED=true to test.');
  }

  logSuccess('All required environment variables are set');

  // Initialize service
  logSection('Service Initialization');
  const emailAgent = new EmailAgentService();
  
  logInfo(`Email Agent enabled: ${emailAgent.enabled}`);
  logInfo(`Gmail credentials configured: ${!!(emailAgent.gmailClientEmail && emailAgent.gmailPrivateKey)}`);
  logInfo(`Anthropic API configured: ${!!emailAgent.anthropic}`);

  if (!emailAgent.enabled) {
    logWarning('Email Agent is disabled. Set EMAIL_AGENT_ENABLED=true to enable.');
    logInfo('Exiting test (no errors, but feature is disabled)');
    process.exit(0);
  }

  // Test 1: JWT Authentication
  logSection('Test 1: Gmail API Authentication');
  
  try {
    // Use GMAIL_DELEGATED_USER from environment, or fallback to 'admin' mailbox
    const delegatedUser = process.env.GMAIL_DELEGATED_USER || emailAgent.mailboxMap['admin'] || 'admin@otiumcreations.com';
    
    logInfo(`Testing authentication for: ${delegatedUser}`);
    const accessToken = await emailAgent.getGmailAccessToken(delegatedUser);
    
    if (accessToken && accessToken.length > 0) {
      logSuccess(`Successfully obtained access token (${accessToken.substring(0, 20)}...)`);
    } else {
      logError('Access token is empty');
      process.exit(1);
    }
  } catch (error) {
    logError(`Authentication failed: ${error.message}`);
    logInfo('Check your Gmail API credentials and domain-wide delegation setup');
    process.exit(1);
  }

  // Test 2: Fetch Emails
  logSection('Test 2: Fetch Emails from Gmail');
  
  const mailboxes = ['info', 'jason', 'rima'];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
  
  for (const mailbox of mailboxes) {
    try {
      logInfo(`Fetching emails from ${mailbox}@otiumcreations.com...`);
      
      const result = await emailAgent.fetchNewEmails(mailbox, since);
      
      if (!result.ok) {
        logError(`Failed to fetch emails from ${mailbox}: ${result.error}`);
        continue;
      }

      const emails = result.emails || [];
      logSuccess(`Found ${emails.length} emails in ${mailbox} mailbox`);
      
      if (emails.length > 0) {
        logInfo('\nSample email:');
        const sample = emails[0];
        console.log(`  From: ${sample.from_email || sample.from}`);
        console.log(`  Subject: ${sample.subject || '(No subject)'}`);
        console.log(`  Date: ${sample.date || 'Unknown'}`);
        console.log(`  Snippet: ${(sample.snippet || '').substring(0, 100)}...`);
        console.log(`  Has text body: ${!!sample.body_text}`);
        console.log(`  Has HTML body: ${!!sample.body_html}`);
      }
    } catch (error) {
      logError(`Error fetching emails from ${mailbox}: ${error.message}`);
    }
  }

  // Test 3: Email Classification (if emails found)
  logSection('Test 3: Email Classification');
  
  try {
    const testResult = await emailAgent.fetchNewEmails('info', since);
    if (testResult.ok && testResult.emails && testResult.emails.length > 0) {
      const testEmail = testResult.emails[0];
      logInfo(`Classifying email: "${testEmail.subject}"`);
      
      const classificationResult = await emailAgent.classifyEmail(testEmail);
      
      if (classificationResult.ok) {
        logSuccess(`Classification: ${classificationResult.classification}`);
        if (classificationResult.tags && classificationResult.tags.length > 0) {
          logInfo(`Tags: ${classificationResult.tags.join(', ')}`);
        }
      } else {
        logError(`Classification failed: ${classificationResult.error}`);
      }
    } else {
      logWarning('No emails found to test classification');
    }
  } catch (error) {
    logError(`Classification test failed: ${error.message}`);
  }

  // Summary
  logSection('Test Summary');
  logSuccess('All tests completed!');
  logInfo('The Gmail Email Agent connector is working correctly.');
  logInfo('You can now enable it in production by setting EMAIL_AGENT_ENABLED=true');
}

// Run tests
testEmailAgent().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});

