/**
 * E2E Tests - Smoke Tests
 * Quick sanity checks that core pages load
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Atlas|Home/i);
  });

  test('rituals page loads successfully', async ({ page }) => {
    await page.goto('/rituals');
    await expect(page).toHaveURL(/.*rituals/);
    await expect(page.locator('h1, h2')).toBeVisible();
  });

  test('app has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Allow known errors (e.g., third-party scripts)
    const criticalErrors = errors.filter(error => 
      !error.includes('third-party') && 
      !error.includes('analytics')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('app is responsive', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});

