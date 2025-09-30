import { test, expect } from '@playwright/test';

test.describe('ChatPage', () => {
  test('ChatPage loads and shows input', async ({ page }) => {
    // Navigate to the chat page
    await page.goto('/chat');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the Atlas AI header is visible
    await expect(page.getByText('Atlas AI')).toBeVisible();
    
    // Check that the message input field exists
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();
    
    // Check that the send button exists
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
    
    // Check that the initial assistant message is visible
    await expect(page.getByText("Hello! I'm Atlas, your AI-powered emotional intelligence companion")).toBeVisible();
  });

  test('ChatPage allows typing and sending messages', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Find the input field and type a test message
    const input = page.getByPlaceholder('Type your message...');
    await input.fill('Hello, Atlas!');
    
    // Verify the text was entered
    await expect(input).toHaveValue('Hello, Atlas!');
    
    // Click the send button
    await page.getByRole('button', { name: /send/i }).click();
    
    // The input should be cleared after sending
    await expect(input).toHaveValue('');
  });

  test('ChatPage shows navigation elements', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Check that navigation elements are visible
    await expect(page.getByText('Chat')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('Logout')).toBeVisible();
  });

  test('ChatPage handles keyboard input', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    const input = page.getByPlaceholder('Type your message...');
    
    // Type a message and press Enter
    await input.fill('Test message');
    await input.press('Enter');
    
    // The input should be cleared after Enter
    await expect(input).toHaveValue('');
  });

  test('ChatPage shows loading state when processing', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    const input = page.getByPlaceholder('Type your message...');
    const sendButton = page.getByRole('button', { name: /send/i });
    
    // Type a message
    await input.fill('Test message');
    
    // Click send and immediately check for loading state
    await sendButton.click();
    
    // The button should show "Sending..." or be disabled
    await expect(sendButton).toBeDisabled();
  });
});
