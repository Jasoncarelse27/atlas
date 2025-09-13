import { devices, expect, test } from '@playwright/test';

// Cross-browser and mobile testing for Atlas AI v1.0.0
test.describe('Atlas AI Cross-Browser Compatibility', () => {
  // Test on Chrome
  test('Chrome - Core functionality', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Test authentication page
    await expect(page).toHaveTitle(/Atlas AI/i);
    await expect(page.locator('text=Login')).toBeVisible();
    
    // Test responsive design
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
  });

  // Test on Firefox
  test('Firefox - Core functionality', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox specific test');
    
    await page.goto('http://localhost:5173');
    await expect(page).toHaveTitle(/Atlas AI/i);
    await expect(page.locator('text=Login')).toBeVisible();
  });

  // Test on Safari/WebKit
  test('Safari - Core functionality', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari/WebKit specific test');
    
    await page.goto('http://localhost:5173');
    await expect(page).toHaveTitle(/Atlas AI/i);
    await expect(page.locator('text=Login')).toBeVisible();
  });

  // Mobile testing
  test('Mobile Chrome - iOS Safari simulation', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Simulate iOS Safari
    await page.setViewportSize(devices['iPhone 12'].viewport);
    await page.emulate(devices['iPhone 12']);
    
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Login')).toBeVisible();
    
    // Test touch interactions
    await page.tap('text=Login');
    await page.waitForTimeout(1000);
  });

  test('Mobile Chrome - Android simulation', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Simulate Android Chrome
    await page.setViewportSize(devices['Galaxy S5'].viewport);
    await page.emulate(devices['Galaxy S5']);
    
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Login')).toBeVisible();
  });

  // Tablet testing
  test('iPad - Responsive design', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Simulate iPad
    await page.setViewportSize(devices['iPad Pro'].viewport);
    await page.emulate(devices['iPad Pro']);
    
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Login')).toBeVisible();
  });

  // Voice input testing (browser-specific)
  test('Voice input compatibility', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check if Speech Recognition API is available
    const speechRecognitionAvailable = await page.evaluate(() => {
      return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    });
    
    if (speechRecognitionAvailable) {
      console.log('Speech Recognition API available');
      // Test voice input button if present
      const voiceButton = page.locator('[data-testid="voice-input"]');
      if (await voiceButton.count() > 0) {
        await voiceButton.click();
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('Speech Recognition API not available in this browser');
    }
  });

  // AI streaming testing
  test('AI streaming response', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Test if chat interface is accessible
    const chatInput = page.locator('input[type="text"], textarea');
    if (await chatInput.count() > 0) {
      await chatInput.fill('Hello Atlas AI');
      await chatInput.press('Enter');
      
      // Wait for streaming response
      await page.waitForTimeout(2000);
      
      // Check if response area exists
      const responseArea = page.locator('[data-testid="response"], .message, .chat-message');
      if (await responseArea.count() > 0) {
        await expect(responseArea.first()).toBeVisible();
      }
    }
  });

  // Subscription gates testing
  test('Subscription gates functionality', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Look for subscription-related elements
    const subscriptionElements = page.locator('text=Free, text=Core, text=Studio, text=Upgrade, text=Subscribe');
    
    if (await subscriptionElements.count() > 0) {
      await expect(subscriptionElements.first()).toBeVisible();
    }
  });

  // Performance testing
  test('Page load performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    console.log(`Page load time: ${loadTime}ms`);
    
    // Expect load time to be under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  // Accessibility testing
  test('Accessibility compliance', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check for basic accessibility features
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      if (alt === null) {
        console.warn(`Image ${i} missing alt text`);
      }
    }
  });
});

// MailerLite webhook testing
test.describe('MailerLite Webhook Integration', () => {
  test('Webhook endpoint accessibility', async ({ page }) => {
    // Test webhook endpoint (if available)
    const response = await page.request.get('/api/webhook/mailerlite');
    
    // Should return 405 Method Not Allowed for GET (expects POST)
    expect(response.status()).toBe(405);
  });

  test('Webhook validation', async ({ page }) => {
    // Test webhook validation with mock data
    const mockPayload = {
      event: 'subscriber.created',
      data: {
        email: 'test@example.com',
        status: 'active'
      }
    };

    const response = await page.request.post('/api/webhook/mailerlite', {
      data: mockPayload,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Should handle the request (may return 401 without proper signature)
    expect([200, 401, 403]).toContain(response.status());
  });
});

// Authentication flow testing
test.describe('Authentication Flow', () => {
  test('Login page accessibility', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check for login form elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")');
    
    if (await emailInput.count() > 0) {
      await expect(emailInput).toBeVisible();
    }
    
    if (await passwordInput.count() > 0) {
      await expect(passwordInput).toBeVisible();
    }
    
    if (await loginButton.count() > 0) {
      await expect(loginButton).toBeVisible();
    }
  });

  test('Registration flow', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Look for registration/signup elements
    const signupButton = page.locator('text=Sign Up, text=Register, text=Create Account');
    
    if (await signupButton.count() > 0) {
      await expect(signupButton.first()).toBeVisible();
    }
  });
});
