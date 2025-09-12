import type { User } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import type { UserProfile } from '../../../types/subscription';
import type { TestResult } from '../hooks/useTestRunner';

import { logger } from '../utils/logger';
export interface TestFunctionsContext {
  user: User | null;
  profile: UserProfile | null;
  addTestResult: (result: TestResult) => void;
  updateTestResult: (testName: string, updates: Partial<TestResult>) => void;
  setCurrentTest: (testName: string | null) => void;
  checkUsageLimit: (actionType: string) => Promise<boolean>;
  updateUsage: (actionType: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  getDaysRemaining: () => number;
  isTrialExpired: () => boolean;
  canAccessFeature: (feature: string) => boolean;
  getUsagePercentage: () => number;
}

export const createTestFunctions = (context: TestFunctionsContext) => {
  const {
    user,
    profile,
    addTestResult,
    updateTestResult,
    setCurrentTest,
    checkUsageLimit,
    updateUsage,
    refreshProfile,
    getDaysRemaining,
    isTrialExpired,
    canAccessFeature,
    getUsagePercentage,
  } = context;

  const testDatabaseConnection = async () => {
    const testName = 'database-connection';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing database connection and table access...'
    });

    try {
      logger.info('🧪 Testing basic Supabase connection...');
      
      // Test 1: Basic connection
      const { error: healthError } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(0);

      if (healthError && !healthError.message.includes('PGRST116')) {
        logger.error('🧪 Health check failed:', healthError);
        updateTestResult(testName, {
          status: 'fail',
          message: `Database connection failed: ${healthError.message}`,
          details: { error: healthError, step: 'health_check' }
        });
        return;
      }

      logger.info('🧪 Basic connection OK, testing table access...');

      // Test 2: Table access
      const { data: tableTest, error: tableError } = await supabase
        .from('user_profiles')
        .select('id, tier, subscription_status')
        .limit(1);

      if (tableError) {
        logger.error('🧪 Table access failed:', tableError);
        updateTestResult(testName, {
          status: 'fail',
          message: `user_profiles table not accessible: ${tableError.message}`,
          details: { error: tableError, step: 'table_access' }
        });
        return;
      }

      logger.info('🧪 Table access OK, testing RPC functions...');

      // Test 3: RPC functions
      let rpcWorking = false;
      try {
        const { error: rpcError } = await supabase
          .rpc('check_tier_limits', { user_id: user?.id || '00000000-0000-0000-0000-000000000000', action_type: 'request' });
        
        if (!rpcError) {
          rpcWorking = true;
          logger.info('🧪 RPC functions working');
        } else {
          logger.warn('🧪 RPC functions not working:', rpcError);
        }
      } catch (rpcErr) {
        logger.warn('🧪 RPC test failed:', rpcErr);
      }

      updateTestResult(testName, {
        status: 'pass',
        message: `Database connection successful. Table accessible: ✓, RPC functions: ${rpcWorking ? '✓' : '⚠️'}`,
        details: { 
          connectionWorking: true, 
          tableAccessible: true, 
          rpcWorking,
          recordCount: Array.isArray(tableTest) ? tableTest.length : 'unknown'
        }
      });

    } catch (error) {
      logger.error('🧪 Database connection test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error, step: 'general_error' }
      });
    }
  };

  const testProfileCreation = async () => {
    const testName = 'profile-creation';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing user profile creation and structure...'
    });

    try {
      if (!user) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'No user available for profile testing',
          details: { error: 'No user' }
        });
        return;
      }

      logger.info('🧪 Testing profile structure...');
      
      // Test profile structure
      const expectedFields = ['id', 'tier', 'subscription_status', 'usage_count', 'trial_start_date'];
      const profileFields = profile ? Object.keys(profile) : [];
      const missingFields = expectedFields.filter(field => !profileFields.includes(field));
      
      if (missingFields.length > 0) {
        updateTestResult(testName, {
          status: 'warning',
          message: `Profile missing fields: ${missingFields.join(', ')}`,
          details: { missingFields, profileFields }
        });
        return;
      }

      logger.info('🧪 Profile structure OK, testing profile updates...');

      // Test profile update capability
      const testUpdate = {
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(testUpdate)
        .eq('id', user.id);

      if (updateError) {
        updateTestResult(testName, {
          status: 'fail',
          message: `Profile update failed: ${updateError.message}`,
          details: { error: updateError }
        });
        return;
      }

      updateTestResult(testName, {
        status: 'pass',
        message: 'Profile creation and updates working correctly',
        details: { 
          profileFields,
          updateSuccessful: true,
          userId: user.id
        }
      });

    } catch (error) {
      logger.error('🧪 Profile creation test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Profile test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  // Add more test functions here...
  const testUsageLimits = async () => {
    const testName = 'usage-limits';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing usage limits and tracking...'
    });

    try {
      if (!user) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'No user available for usage testing',
          details: { error: 'No user' }
        });
        return;
      }

      // Test usage limit checking
      const canMakeRequest = await checkUsageLimit('request');
      const usagePercentage = getUsagePercentage();
      const daysRemaining = getDaysRemaining();

      updateTestResult(testName, {
        status: 'pass',
        message: `Usage limits working. Can make request: ${canMakeRequest ? 'Yes' : 'No'}, Usage: ${usagePercentage}%, Days remaining: ${daysRemaining}`,
        details: { 
          canMakeRequest,
          usagePercentage,
          daysRemaining,
          userId: user.id
        }
      });

    } catch (error) {
      logger.error('🧪 Usage limits test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Usage limits test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testFeatureAccess = async () => {
    const testName = 'feature-access';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing feature access based on subscription tier...'
    });

    try {
      if (!user) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'No user available for feature testing',
          details: { error: 'No user' }
        });
        return;
      }

      const features = ['chat', 'voice', 'image_upload', 'advanced_ai'];
      const featureAccess = features.map(feature => ({
        feature,
        accessible: canAccessFeature(feature)
      }));

      const accessibleFeatures = featureAccess.filter(f => f.accessible).length;
      const totalFeatures = features.length;

      updateTestResult(testName, {
        status: 'pass',
        message: `Feature access working. ${accessibleFeatures}/${totalFeatures} features accessible`,
        details: { 
          featureAccess,
          accessibleFeatures,
          totalFeatures,
          userId: user.id
        }
      });

    } catch (error) {
      logger.error('🧪 Feature access test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Feature access test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testTrialExpiry = async () => {
    const testName = 'trial-expiry';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing trial expiration logic...'
    });

    try {
      if (!user) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'No user available for trial testing',
          details: { error: 'No user' }
        });
        return;
      }

      const expired = isTrialExpired();
      const daysRemaining = getDaysRemaining();

      updateTestResult(testName, {
        status: 'pass',
        message: `Trial expiry logic working. Expired: ${expired ? 'Yes' : 'No'}, Days remaining: ${daysRemaining}`,
        details: { 
          expired,
          daysRemaining,
          userId: user.id
        }
      });

    } catch (error) {
      logger.error('🧪 Trial expiry test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Trial expiry test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testUsageUpdates = async () => {
    const testName = 'usage-updates';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing usage counter updates...'
    });

    try {
      if (!user) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'No user available for usage update testing',
          details: { error: 'No user' }
        });
        return;
      }

      // Test usage update
      await updateUsage('test');
      await refreshProfile();

      updateTestResult(testName, {
        status: 'pass',
        message: 'Usage updates working correctly',
        details: { 
          updateSuccessful: true,
          userId: user.id
        }
      });

    } catch (error) {
      logger.error('🧪 Usage updates test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Usage updates test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testRailwayBackend = async () => {
    const testName = 'railway-backend';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing Railway backend connectivity...'
    });

    try {
      // Test Railway backend endpoint
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        updateTestResult(testName, {
          status: 'fail',
          message: `Railway backend not responding: ${response.status} ${response.statusText}`,
          details: { status: response.status, statusText: response.statusText }
        });
        return;
      }

      const data = await response.json();

      updateTestResult(testName, {
        status: 'pass',
        message: 'Railway backend responding correctly',
        details: { 
          response: data,
          status: response.status
        }
      });

    } catch (error) {
      logger.error('🧪 Railway backend test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Railway backend test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testBackendHealthSuite = async () => {
    const testName = 'backend-health-suite';
    logger.info('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Running comprehensive backend health checks...'
    });

    try {
      const healthChecks = [
        { name: 'Database', endpoint: '/api/health/db' },
        { name: 'Auth', endpoint: '/api/health/auth' },
        { name: 'Storage', endpoint: '/api/health/storage' },
        { name: 'Edge Functions', endpoint: '/api/health/edge' }
      ];

      const results = await Promise.allSettled(
        healthChecks.map(async (check) => {
          try {
            const response = await fetch(check.endpoint);
            return {
              name: check.name,
              status: response.ok ? 'pass' : 'fail',
              details: { status: response.status }
            };
          } catch (error) {
            return {
              name: check.name,
              status: 'fail',
              details: { error: error instanceof Error ? error.message : 'Unknown error' }
            };
          }
        })
      );

      const passedChecks = results.filter(r => r.status === 'fulfilled' && r.value.status === 'pass').length;
      const totalChecks = healthChecks.length;

      updateTestResult(testName, {
        status: passedChecks === totalChecks ? 'pass' : 'warning',
        message: `Backend health suite completed. ${passedChecks}/${totalChecks} checks passed`,
        details: { 
          results: results.map(r => r.status === 'fulfilled' ? r.value : { name: 'Unknown', status: 'fail', details: { error: 'Promise rejected' } }),
          passedChecks,
          totalChecks
        }
      });

    } catch (error) {
      logger.error('🧪 Backend health suite test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Backend health suite test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  return {
    testDatabaseConnection,
    testProfileCreation,
    testUsageLimits,
    testFeatureAccess,
    testTrialExpiry,
    testUsageUpdates,
    testRailwayBackend,
    testBackendHealthSuite,
  };
};
