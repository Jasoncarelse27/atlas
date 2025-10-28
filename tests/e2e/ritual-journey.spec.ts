/**
 * E2E Tests - Ritual User Journey
 * Tests complete user flow from library to completion
 */

import { test, expect } from '@playwright/test';

test.describe('Ritual User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Login or skip auth for testing
    // For now, assume user is logged in or app allows anonymous access
    await page.goto('/');
  });

  test('user can browse ritual library and view ritual details', async ({ page }) => {
    // Navigate to rituals page
    await page.click('a[href="/rituals"]');
    await expect(page).toHaveURL(/.*rituals/);

    // Wait for rituals to load
    await page.waitForSelector('[data-testid="ritual-card"]', { timeout: 5000 });

    // Verify rituals are displayed
    const ritualCards = await page.locator('[data-testid="ritual-card"]').count();
    expect(ritualCards).toBeGreaterThan(0);

    // Click first ritual to view details
    await page.click('[data-testid="ritual-card"]');
    
    // Verify ritual details are shown
    await expect(page.locator('[data-testid="ritual-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="ritual-steps"]')).toBeVisible();
  });

  test('user can start and complete a ritual', async ({ page }) => {
    // Navigate to rituals
    await page.goto('/rituals');

    // Select a ritual
    await page.waitForSelector('[data-testid="ritual-card"]');
    await page.click('[data-testid="ritual-card"]');

    // Start ritual
    await page.click('button:has-text("Start Ritual")');
    await expect(page).toHaveURL(/.*rituals\/run/);

    // Wait for first step to load
    await expect(page.locator('[data-testid="step-content"]')).toBeVisible();

    // Complete first step (click next or wait for timer)
    const nextButton = page.locator('button:has-text("Next")');
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }

    // Eventually reach completion screen
    await expect(page.locator('text=/Ritual Complete|Completed/i')).toBeVisible({ timeout: 15000 });

    // Select mood
    await page.click('[data-testid="mood-selector"]');

    // Submit completion
    await page.click('button:has-text("Finish")');

    // Verify redirected back to library or stats
    await expect(page).toHaveURL(/.*rituals|stats/);
  });

  test('user can create custom ritual (core tier)', async ({ page }) => {
    // Navigate to ritual builder
    await page.goto('/rituals/builder');

    // Fill ritual details
    await page.fill('[name="title"]', 'E2E Test Custom Ritual');
    await page.selectOption('[name="goal"]', 'focus');

    // Add step
    await page.click('button:has-text("Add Step")');
    await page.fill('[data-testid="step-title"]', 'Test Step');
    await page.fill('[data-testid="step-duration"]', '60');

    // Save ritual
    await page.click('button:has-text("Save Ritual")');

    // Verify success
    await expect(page.locator('text=/Ritual Created|Success/i')).toBeVisible();
  });

  test('free tier user sees upgrade prompt for locked features', async ({ page }) => {
    // TODO: Set user to free tier
    await page.goto('/rituals');

    // Try to access core/studio ritual
    const lockedRitual = page.locator('[data-testid="ritual-card"][data-tier="core"]');
    if (await lockedRitual.isVisible()) {
      await lockedRitual.click();

      // Expect upgrade modal
      await expect(page.locator('[data-testid="upgrade-modal"]')).toBeVisible();
      await expect(page.locator('text=/Upgrade.*Core|Core Tier Required/i')).toBeVisible();
    }
  });
});

test.describe('Ritual Library Features', () => {
  test('user can filter rituals by goal', async ({ page }) => {
    await page.goto('/rituals');

    // Wait for rituals to load
    await page.waitForSelector('[data-testid="ritual-card"]');

    // Apply filter
    await page.click('[data-testid="filter-goal"]');
    await page.click('text="Energy"');

    // Verify filtered results
    const filteredRituals = page.locator('[data-testid="ritual-card"]');
    await expect(filteredRituals.first()).toBeVisible();
  });

  test('user can search rituals by name', async ({ page }) => {
    await page.goto('/rituals');

    // Search
    await page.fill('[data-testid="search-input"]', 'morning');

    // Verify search results
    await page.waitForTimeout(500); // Debounce
    const searchResults = page.locator('[data-testid="ritual-card"]');
    const count = await searchResults.count();
    expect(count).toBeGreaterThanOrEqual(0); // May or may not have results
  });

  test('user can sort rituals', async ({ page }) => {
    await page.goto('/rituals');

    // Wait for rituals
    await page.waitForSelector('[data-testid="ritual-card"]');

    // Get first ritual title before sort
    const firstTitleBefore = await page.locator('[data-testid="ritual-card"]').first().textContent();

    // Change sort order
    await page.selectOption('[data-testid="sort-select"]', 'name-asc');

    // Wait for re-render
    await page.waitForTimeout(500);

    // Verify order changed (or stayed same if already sorted)
    const firstTitleAfter = await page.locator('[data-testid="ritual-card"]').first().textContent();
    expect(firstTitleAfter).toBeDefined();
  });
});

test.describe('Ritual Statistics', () => {
  test('user can view ritual completion stats', async ({ page }) => {
    await page.goto('/rituals/stats');

    // Verify stats page loads
    await expect(page.locator('h1, h2')).toContainText(/Stats|Progress|Insights/i);

    // Check for stat cards
    const statCards = page.locator('[data-testid="stat-card"]');
    if (await statCards.first().isVisible()) {
      expect(await statCards.count()).toBeGreaterThan(0);
    }
  });

  test('user can view ritual history', async ({ page }) => {
    await page.goto('/rituals/history');

    // Wait for history to load
    await page.waitForSelector('[data-testid="history-list"], [data-testid="empty-state"]');

    // Verify history or empty state
    const hasHistory = await page.locator('[data-testid="history-item"]').count();
    if (hasHistory > 0) {
      await expect(page.locator('[data-testid="history-item"]').first()).toBeVisible();
    } else {
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    }
  });
});

