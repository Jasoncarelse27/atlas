/**
 * iOS In-App Purchase Service
 * Handles App Store purchases for iOS native apps
 */

import { logger } from '../lib/logger';
import { getApiEndpoint } from '../utils/apiClient';
import type { Tier } from '../types/tier';

export interface IAPPurchaseResult {
  success: boolean;
  tier?: Tier;
  transactionId?: string;
  receipt?: string;
  error?: string;
}

export interface IAPProduct {
  productId: string;
  price: string;
  currency: string;
  title: string;
  description: string;
}

class IOSIAPService {
  private isAvailable: boolean = false;

  /**
   * Check if IAP is available (native iOS app)
   */
  async checkAvailability(): Promise<boolean> {
    // Check if running in native iOS app
    if (typeof window === 'undefined') {
      return false;
    }

    // Check for React Native IAP or Expo IAP
    const hasReactNativeIAP = typeof (window as any).RNIap !== 'undefined';
    const hasExpoIAP = typeof (window as any).Expo?.InAppPurchases !== 'undefined';
    
    this.isAvailable = hasReactNativeIAP || hasExpoIAP;
    
    if (!this.isAvailable) {
      logger.debug('[iOS IAP] Not available - running in web browser');
    }
    
    return this.isAvailable;
  }

  /**
   * Get product IDs for tiers
   */
  private getProductIdForTier(tier: 'core' | 'studio'): string {
    const productIds: Record<'core' | 'studio', string> = {
      core: 'atlas-core-monthly-ios',
      studio: 'atlas-studio-monthly-ios',
    };
    
    return productIds[tier];
  }

  /**
   * Fetch available products from App Store
   */
  async fetchProducts(tiers: ('core' | 'studio')[]): Promise<IAPProduct[]> {
    if (!this.isAvailable) {
      throw new Error('IAP not available on this platform');
    }

    const productIds = tiers.map(tier => this.getProductIdForTier(tier));
    
    try {
      // For React Native IAP
      if (typeof (window as any).RNIap !== 'undefined') {
        const RNIap = (window as any).RNIap;
        const products = await RNIap.getProducts(productIds);
        return products.map((p: any) => ({
          productId: p.productId,
          price: p.localizedPrice,
          currency: p.currency,
          title: p.title,
          description: p.description,
        }));
      }
      
      // For Expo IAP
      if (typeof (window as any).Expo?.InAppPurchases !== 'undefined') {
        const { InAppPurchases } = (window as any).Expo;
        const products = await InAppPurchases.getProductsAsync(productIds);
        return products.map((p: any) => ({
          productId: p.productId,
          price: p.price,
          currency: p.currency,
          title: p.title,
          description: p.description,
        }));
      }
      
      throw new Error('No IAP SDK available');
    } catch (error) {
      logger.error('[iOS IAP] Failed to fetch products:', error);
      throw error;
    }
  }

  /**
   * Purchase subscription
   */
  async purchaseSubscription(tier: 'core' | 'studio'): Promise<IAPPurchaseResult> {
    if (!this.isAvailable) {
      return {
        success: false,
        error: 'IAP not available on this platform. Please use the web version to upgrade.',
      };
    }

    const productId = this.getProductIdForTier(tier);
    
    try {
      let purchaseResult: any;
      
      // For React Native IAP
      if (typeof (window as any).RNIap !== 'undefined') {
        const RNIap = (window as any).RNIap;
        purchaseResult = await RNIap.requestPurchase(productId);
      }
      // For Expo IAP
      else if (typeof (window as any).Expo?.InAppPurchases !== 'undefined') {
        const { InAppPurchases } = (window as any).Expo;
        purchaseResult = await InAppPurchases.purchaseItemAsync(productId);
      }
      else {
        throw new Error('No IAP SDK available');
      }

      // Verify receipt with backend
      const verificationResult = await this.verifyReceipt(
        purchaseResult.transactionReceipt || purchaseResult.receipt,
        purchaseResult.transactionId || purchaseResult.orderId,
        tier
      );

      if (verificationResult.success) {
        return {
          success: true,
          tier,
          transactionId: purchaseResult.transactionId || purchaseResult.orderId,
          receipt: purchaseResult.transactionReceipt || purchaseResult.receipt,
        };
      }

      return verificationResult;
    } catch (error) {
      logger.error('[iOS IAP] Purchase failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle user cancellation
      if (errorMessage.includes('cancel') || errorMessage.includes('Cancelled')) {
        return {
          success: false,
          error: 'Purchase cancelled',
        };
      }
      
      return {
        success: false,
        error: `Purchase failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<IAPPurchaseResult[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      let purchases: any[] = [];
      
      // For React Native IAP
      if (typeof (window as any).RNIap !== 'undefined') {
        const RNIap = (window as any).RNIap;
        purchases = await RNIap.getAvailablePurchases();
      }
      // For Expo IAP
      else if (typeof (window as any).Expo?.InAppPurchases !== 'undefined') {
        const { InAppPurchases } = (window as any).Expo;
        purchases = await InAppPurchases.getPurchaseHistoryAsync();
      }
      
      const results: IAPPurchaseResult[] = [];
      
      for (const purchase of purchases) {
        const productId = purchase.productId;
        const tier = productId.includes('core') ? 'core' : 'studio';
        
        const verificationResult = await this.verifyReceipt(
          purchase.transactionReceipt || purchase.receipt,
          purchase.transactionId || purchase.orderId,
          tier
        );
        
        results.push(verificationResult);
      }
      
      return results;
    } catch (error) {
      logger.error('[iOS IAP] Restore purchases failed:', error);
      return [];
    }
  }

  /**
   * Verify receipt with backend
   */
  private async verifyReceipt(
    receipt: string,
    transactionId: string,
    tier: 'core' | 'studio'
  ): Promise<IAPPurchaseResult> {
    try {
      const response = await fetch(getApiEndpoint('/api/iap/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receipt,
          transactionId,
          tier,
          platform: 'ios',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: `Receipt verification failed: ${errorData.error || response.statusText}`,
        };
      }

      const data = await response.json();
      
      return {
        success: data.success === true,
        tier: data.tier,
        transactionId,
        receipt,
      };
    } catch (error) {
      logger.error('[iOS IAP] Receipt verification error:', error);
      return {
        success: false,
        error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const iosIAPService = new IOSIAPService();

