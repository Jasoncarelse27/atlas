/**
 * E2E Tests - Mobile Gestures and Interactions
 * Tests touch interactions, swipes, and mobile-specific features
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile - Ritual Run Gestures', () => {
  test('user can swipe through ritual steps', async ({ page }) => {
    // Navigate to a ritual run
    await page.goto('/rituals');
    await page.waitForSelector('[data-testid="ritual-card"]');
    await page.click('[data-testid="ritual-card"]');
    await page.click('button:has-text("Start")');

    // Wait for first step
    await page.waitForSelector('[data-testid="step-content"]');

    // Get initial step indicator
    const stepIndicatorBefore = await page.locator('[data-testid="step-indicator"]').textContent();

    // Swipe left (next step)
    await page.touchscreen.swipe(
      { x: 300, y: 400 },
      { x: 50, y: 400 }
    );

    // Wait for animation
    await page.waitForTimeout(500);

    // Verify step changed
    const stepIndicatorAfter = await page.locator('[data-testid="step-indicator"]').textContent();
    expect(stepIndicatorAfter).not.toBe(stepIndicatorBefore);
  });

  test('user can swipe right to go back to previous step', async ({ page }) => {
    await page.goto('/rituals/run/test-ritual');
    await page.waitForSelector('[data-testid="step-content"]');

    // Swipe left to go to step 2
    await page.touchscreen.swipe(
      { x: 300, y: 400 },
      { x: 50, y: 400 }
    );

    await page.waitForTimeout(500);

    // Swipe right to go back
    await page.touchscreen.swipe(
      { x: 50, y: 400 },
      { x: 300, y: 400 }
    );

    await page.waitForTimeout(500);

    // Verify back at step 1
    await expect(page.locator('[data-testid="step-indicator"]')).toContainText('1');
  });

  test('swipe gestures trigger haptic feedback', async ({ page, context }) => {
    // Note: Haptic feedback can't be directly tested in Playwright
    // But we can verify the code is called via console logs or network requests
    
    await page.goto('/rituals/run/test-ritual');
    await page.waitForSelector('[data-testid="step-content"]');

    // Set up console listener
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Swipe
    await page.touchscreen.swipe(
      { x: 300, y: 400 },
      { x: 50, y: 400 }
    );

    await page.waitForTimeout(500);

    // Verify haptic was triggered (if logging is enabled)
    // This is a soft check - haptic may not log in production
    expect(consoleMessages.some(msg => msg.includes('haptic') || msg.includes('vibrate'))).toBeTruthy();
  });
});

test.describe('Mobile - Touch Targets', () => {
  test('ritual cards have large enough touch targets', async ({ page }) => {
    await page.goto('/rituals');
    await page.waitForSelector('[data-testid="ritual-card"]');

    // Get card dimensions
    const card = page.locator('[data-testid="ritual-card"]').first();
    const box = await card.boundingBox();

    // Verify minimum 120px height (mobile standard from implementation)
    expect(box?.height).toBeGreaterThanOrEqual(120);
  });

  test('buttons have minimum 48px touch targets', async ({ page }) => {
    await page.goto('/rituals/builder');

    // Check primary buttons
    const buttons = page.locator('button');
    const firstButton = buttons.first();
    const box = await firstButton.boundingBox();

    // Verify minimum 48px (mobile accessibility standard)
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('floating action button is accessible on mobile', async ({ page }) => {
    await page.goto('/rituals');

    // FAB should be visible on mobile
    const fab = page.locator('[data-testid="fab-create-ritual"]');
    await expect(fab).toBeVisible();

    // Verify it's in bottom-right corner
    const box = await fab.boundingBox();
    const viewport = page.viewportSize();

    if (box && viewport) {
      expect(box.x + box.width).toBeGreaterThan(viewport.width * 0.8);
      expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.8);
    }
  });
});

test.describe('Mobile - Pull-to-Refresh', () => {
  test('user can pull down to refresh ritual library', async ({ page }) => {
    await page.goto('/rituals');
    await page.waitForSelector('[data-testid="ritual-card"]');

    // Pull down from top
    await page.touchscreen.swipe(
      { x: 200, y: 100 },
      { x: 200, y: 400 }
    );

    // Verify refresh indicator shows
    await expect(page.locator('[data-testid="refresh-indicator"]')).toBeVisible({ timeout: 1000 });

    // Wait for refresh to complete
    await expect(page.locator('[data-testid="refresh-indicator"]')).toBeHidden({ timeout: 3000 });
  });
});

test.describe('Mobile - Bottom Sheet', () => {
  test('locked ritual preview shows in bottom sheet', async ({ page }) => {
    await page.goto('/rituals');

    // Click locked ritual (if exists)
    const lockedRitual = page.locator('[data-testid="ritual-card"][data-locked="true"]');
    if (await lockedRitual.isVisible()) {
      await lockedRitual.click();

      // Verify bottom sheet appears
      await expect(page.locator('[data-testid="bottom-sheet"]')).toBeVisible();

      // Verify can close by tapping backdrop
      await page.click('[data-testid="bottom-sheet-backdrop"]');
      await expect(page.locator('[data-testid="bottom-sheet"]')).toBeHidden();
    }
  });

  test('step config shows in bottom sheet on mobile', async ({ page }) => {
    await page.goto('/rituals/builder');

    // Add a step
    await page.click('button:has-text("Add Step")');

    // Click to edit step (should show bottom sheet on mobile)
    await page.click('[data-testid="step-card"]');

    // Verify bottom sheet appears
    await expect(page.locator('[data-testid="step-config-sheet"]')).toBeVisible();
  });
});

test.describe('Mobile - Landscape Mode', () => {
  test.use({
    viewport: { width: 844, height: 390 }, // iPhone 12 Pro landscape
  });

  test('ritual run adapts to landscape orientation', async ({ page }) => {
    await page.goto('/rituals/run/test-ritual');
    await page.waitForSelector('[data-testid="step-content"]');

    // Verify landscape-specific layout
    const stepContent = page.locator('[data-testid="step-content"]');
    const box = await stepContent.boundingBox();

    // In landscape, content should be wider than tall
    if (box) {
      expect(box.width).toBeGreaterThan(box.height);
    }
  });

  test('timer display is readable in landscape', async ({ page }) => {
    await page.goto('/rituals/run/test-ritual');
    await page.waitForSelector('[data-testid="timer"]');

    // Verify timer is visible and large enough
    const timer = page.locator('[data-testid="timer"]');
    await expect(timer).toBeVisible();

    const fontSize = await timer.evaluate(el => 
      window.getComputedStyle(el).fontSize
    );

    // Verify large text (should be 3rem+ in landscape)
    expect(parseInt(fontSize)).toBeGreaterThan(40);
  });
});

test.describe('Mobile - Drag and Drop', () => {
  test('user can reorder steps with touch drag', async ({ page }) => {
    await page.goto('/rituals/builder');

    // Add multiple steps
    await page.click('button:has-text("Add Step")');
    await page.fill('[data-testid="step-title"]', 'Step 1');
    await page.click('button:has-text("Add Step")');
    await page.fill('[data-testid="step-title"]', 'Step 2');

    // Get initial order
    const step1Before = await page.locator('[data-testid="step-card"]').first().textContent();

    // Drag first step down
    const dragHandle = page.locator('[data-testid="drag-handle"]').first();
    const dragBox = await dragHandle.boundingBox();

    if (dragBox) {
      await page.touchscreen.tap(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
      await page.touchscreen.move(dragBox.x + dragBox.width / 2, dragBox.y + 150);
    }

    await page.waitForTimeout(500);

    // Verify order changed
    const step1After = await page.locator('[data-testid="step-card"]').first().textContent();
    expect(step1After).not.toBe(step1Before);
  });
});

test.describe('Mobile - Responsive Design', () => {
  test('navigation adapts to mobile viewport', async ({ page }) => {
    await page.goto('/');

    // Verify mobile nav (hamburger menu or bottom nav)
    const mobileNav = page.locator('[data-testid="mobile-nav"], [data-testid="hamburger-menu"]');
    await expect(mobileNav).toBeVisible();
  });

  test('text is readable on small screens', async ({ page }) => {
    await page.goto('/rituals');

    // Check primary text size
    const title = page.locator('h1, h2').first();
    const fontSize = await title.evaluate(el => 
      window.getComputedStyle(el).fontSize
    );

    // Minimum 16px for body text, 24px+ for headers
    expect(parseInt(fontSize)).toBeGreaterThanOrEqual(24);
  });

  test('images and media scale correctly', async ({ page }) => {
    await page.goto('/rituals');

    // Check if images exist and fit viewport
    const images = page.locator('img');
    const count = await images.count();

    if (count > 0) {
      const firstImage = images.first();
      const box = await firstImage.boundingBox();
      const viewport = page.viewportSize();

      if (box && viewport) {
        // Image should not overflow viewport
        expect(box.width).toBeLessThanOrEqual(viewport.width);
      }
    }
  });
});

