/**
 * Mock external services for E2E tests
 * This ensures tests don't depend on real credentials or external services
 */

import { test as base, expect } from '@playwright/test';

// Mock MailerLite responses
export const mockMailerLiteResponses = {
  subscriberCreated: {
    success: true,
    data: {
      id: 'test-subscriber-123',
      email: 'test@example.com',
      status: 'active',
      created_at: new Date().toISOString()
    }
  },
  subscriberUpdated: {
    success: true,
    data: {
      id: 'test-subscriber-123',
      email: 'test@example.com',
      status: 'active',
      fields: { name: 'Test User' }
    }
  },
  subscriberUnsubscribed: {
    success: true,
    data: {
      id: 'test-subscriber-123',
      email: 'test@example.com',
      unsubscribed_at: new Date().toISOString()
    }
  }
};

// Mock Stripe responses
export const mockStripeResponses = {
  paymentIntentSucceeded: {
    id: 'pi_test_123',
    status: 'succeeded',
    amount: 2999,
    currency: 'usd',
    metadata: {
      subscription_tier: 'core'
    }
  },
  subscriptionCreated: {
    id: 'sub_test_123',
    status: 'active',
    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
    items: {
      data: [{
        price: {
          id: 'price_core_monthly',
          unit_amount: 2999
        }
      }]
    }
  }
};

// Mock Supabase responses
export const mockSupabaseResponses = {
  userProfile: {
    id: 'test-user-123',
    email: 'test@example.com',
    subscription_tier: 'free',
    messages_used: 5,
    messages_limit: 10,
    created_at: new Date().toISOString()
  },
  conversation: {
    id: 'test-conv-123',
    title: 'Test Conversation',
    user_id: 'test-user-123',
    created_at: new Date().toISOString()
  },
  message: {
    id: 'test-msg-123',
    content: 'Hello, this is a test message',
    role: 'user',
    conversation_id: 'test-conv-123',
    created_at: new Date().toISOString()
  }
};

// Mock AI responses
export const mockAIResponses = {
  chatCompletion: {
    id: 'chatcmpl-test-123',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello! I\'m Atlas, your AI assistant. How can I help you today?'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }
  }
};

// Enhanced test fixture with mocked services
export const test = base.extend({
  // Mock external API calls
  mockExternalServices: async ({ page }, use) => {
    // Mock MailerLite webhook endpoint
    await page.route('**/api/webhook/mailerlite', async (route) => {
      const request = route.request();
      const body = await request.postDataJSON();
      
      let response;
      switch (body.event) {
        case 'subscriber.created':
          response = mockMailerLiteResponses.subscriberCreated;
          break;
        case 'subscriber.updated':
          response = mockMailerLiteResponses.subscriberUpdated;
          break;
        case 'subscriber.unsubscribed':
          response = mockMailerLiteResponses.subscriberUnsubscribed;
          break;
        default:
          response = { success: true, message: 'Event processed' };
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });

    // Mock Stripe webhook endpoint
    await page.route('**/api/webhook/stripe', async (route) => {
      const request = route.request();
      const body = await request.postDataJSON();
      
      let response;
      switch (body.type) {
        case 'payment_intent.succeeded':
          response = mockStripeResponses.paymentIntentSucceeded;
          break;
        case 'customer.subscription.created':
          response = mockStripeResponses.subscriptionCreated;
          break;
        default:
          response = { received: true };
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });

    // Mock Supabase API calls
    await page.route('**/api/messages/**', async (route) => {
      const url = new URL(route.request().url());
      
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockSupabaseResponses.message])
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockSupabaseResponses.message)
        });
      }
    });

    // Mock AI API calls
    await page.route('**/api/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAIResponses.chatCompletion)
      });
    });

    // Mock subscription status endpoint
    await page.route('**/api/subscription/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSupabaseResponses.userProfile)
      });
    });

    await use({});
  }
});

export { expect };
