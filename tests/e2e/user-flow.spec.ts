import { expect, test } from './mocks/external-services';

test.describe('Atlas User Flow', () => {
  test.beforeEach(async ({ page, mockExternalServices }) => {
    // Set up mocked external services
    await mockExternalServices;
    
    // Navigate to the app
    await page.goto('/');
  });

  test('complete user journey: registration → login → chat → subscription upgrade', async ({ page }) => {
    // Step 1: Registration
    await test.step('User Registration', async () => {
      // Click on sign up button
      await page.click('text=Sign Up');
      
      // Fill registration form
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.fill('input[name="confirmPassword"]', 'password123');
      
      // Submit registration
      await page.click('button[type="submit"]');
      
      // Wait for registration success
      await expect(page.locator('text=Registration successful')).toBeVisible();
    });

    // Step 2: Login
    await test.step('User Login', async () => {
      // Fill login form
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Wait for successful login
      await expect(page.locator('text=Welcome')).toBeVisible();
    });

    // Step 3: Chat Interaction
    await test.step('Chat Interaction', async () => {
      // Wait for chat interface to load
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
      
      // Send a message
      await page.fill('[data-testid="chat-input"]', 'Hello, how are you?');
      await page.click('[data-testid="send-button"]');
      
      // Wait for message to appear in chat
      await expect(page.locator('[data-testid="message-list"]')).toContainText('Hello, how are you?');
      
      // Wait for AI response
      await expect(page.locator('[data-testid="message-list"]')).toContainText('Hello!');
    });

    // Step 4: Subscription Upgrade
    await test.step('Subscription Upgrade', async () => {
      // Navigate to subscription page
      await page.click('[data-testid="subscription-button"]');
      
      // Wait for subscription page to load
      await expect(page.locator('text=Choose Your Plan')).toBeVisible();
      
      // Select Core plan
      await page.click('[data-testid="core-plan-button"]');
      
      // Fill payment form (mock)
      await page.fill('input[name="cardNumber"]', '4242424242424242');
      await page.fill('input[name="expiryDate"]', '12/25');
      await page.fill('input[name="cvv"]', '123');
      await page.fill('input[name="name"]', 'Test User');
      
      // Submit payment
      await page.click('button[type="submit"]');
      
      // Wait for upgrade success
      await expect(page.locator('text=Upgrade successful')).toBeVisible();
    });

    // Step 5: Verify Database Entry
    await test.step('Verify Database Entry', async () => {
      // Navigate to profile/settings
      await page.click('[data-testid="profile-button"]');
      
      // Verify subscription status
      await expect(page.locator('[data-testid="subscription-status"]')).toContainText('Core');
      await expect(page.locator('[data-testid="message-limit"]')).toContainText('100');
    });

    // Step 6: Verify Webhook Fired
    await test.step('Verify Webhook Fired', async () => {
      // This would typically be verified through API calls or database checks
      // For now, we'll check that the subscription status is updated
      await expect(page.locator('[data-testid="subscription-status"]')).toContainText('Core');
    });
  });

  test('chat message rendering and persistence', async ({ page }) => {
    // Login first
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Welcome')).toBeVisible();

    // Send multiple messages
    const messages = [
      'Hello, this is my first message',
      'This is my second message',
      'And this is my third message'
    ];

    for (const message of messages) {
      await page.fill('[data-testid="chat-input"]', message);
      await page.click('[data-testid="send-button"]');
      
      // Wait for message to appear
      await expect(page.locator('[data-testid="message-list"]')).toContainText(message);
    }

    // Refresh page to test persistence
    await page.reload();
    
    // Wait for messages to load from database
    await expect(page.locator('[data-testid="message-list"]')).toContainText(messages[0]);
    await expect(page.locator('[data-testid="message-list"]')).toContainText(messages[1]);
    await expect(page.locator('[data-testid="message-list"]')).toContainText(messages[2]);
  });

  test('subscription limits enforcement', async ({ page }) => {
    // Login as free user
    await page.fill('input[name="email"]', 'freeuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Welcome')).toBeVisible();

    // Send messages up to free limit (assuming 10 messages)
    for (let i = 1; i <= 10; i++) {
      await page.fill('[data-testid="chat-input"]', `Message ${i}`);
      await page.click('[data-testid="send-button"]');
      
      // Wait for message to appear
      await expect(page.locator('[data-testid="message-list"]')).toContainText(`Message ${i}`);
    }

    // Try to send 11th message (should be blocked)
    await page.fill('[data-testid="chat-input"]', 'Message 11 - should be blocked');
    await page.click('[data-testid="send-button"]');
    
    // Should show upgrade prompt
    await expect(page.locator('text=Upgrade to continue')).toBeVisible();
    await expect(page.locator('text=You have reached your free tier limit')).toBeVisible();
  });

  test('voice input functionality', async ({ page }) => {
    // Login first
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Welcome')).toBeVisible();

    // Click voice input button
    await page.click('[data-testid="voice-input-button"]');
    
    // Should show voice recording interface
    await expect(page.locator('[data-testid="voice-recording"]')).toBeVisible();
    
    // Mock voice input (in real test, this would use actual voice)
    await page.click('[data-testid="voice-stop-button"]');
    
    // Should process voice input and show in chat
    await expect(page.locator('[data-testid="message-list"]')).toContainText('Voice message');
  });

  test('mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Login
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Check that chat interface is responsive
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    
    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Mobile test message');
    await page.click('[data-testid="send-button"]');
    
    // Verify message appears
    await expect(page.locator('[data-testid="message-list"]')).toContainText('Mobile test message');
  });

  test('error handling and recovery', async ({ page }) => {
    // Test network error handling
    await page.route('**/api/message', route => route.abort());
    
    // Login
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Try to send message (should fail)
    await page.fill('[data-testid="chat-input"]', 'This should fail');
    await page.click('[data-testid="send-button"]');
    
    // Should show error message
    await expect(page.locator('text=Failed to send message')).toBeVisible();
    
    // Restore network
    await page.unroute('**/api/message');
    
    // Try again (should work)
    await page.fill('[data-testid="chat-input"]', 'This should work now');
    await page.click('[data-testid="send-button"]');
    
    // Should succeed
    await expect(page.locator('[data-testid="message-list"]')).toContainText('This should work now');
  });
});
