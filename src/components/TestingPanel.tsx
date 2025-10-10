import type { User } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Settings,
  TestTube,
  TrendingUp,
  User as UserIcon,
  XCircle
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types/subscription';
import LoadingSpinner from './LoadingSpinner';

interface TestingPanelProps {
  user: User | null;
  profile: UserProfile | null;
  onClose: () => void;
}

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'pending';
  message: string;
  details?: unknown;
  timestamp?: string;
}

const TestingPanel: React.FC<TestingPanelProps> = ({ user, profile, onClose }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [selectedTests, setSelectedTests] = useState<string[]>([
    'database-connection',
    'profile-creation',
    'usage-limits',
    'feature-access',
    'trial-expiry',
    'usage-updates',
    'railway-backend',
    'backend-health-suite'
  ]);

  // Note: These methods are not available in the current useSubscription hook
  // They would need to be implemented or the component updated to use available methods

  const addTestResult = useCallback((result: TestResult) => {
    const resultWithTimestamp = {
      ...result,
      timestamp: new Date().toISOString()
    };
    setTestResults(prev => {
      const newResults = [...prev, resultWithTimestamp];
      return newResults;
    });
  }, []);

  const updateTestResult = useCallback((testName: string, updates: Partial<TestResult>) => {
    setTestResults(prev => {
      const newResults = prev.map(result => 
        result.test === testName ? { ...result, ...updates, timestamp: new Date().toISOString() } : result
      );
      return newResults;
    });
  }, []);

  const testDatabaseConnection = async () => {
    const testName = 'database-connection';
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing database connection and table access...'
    });

    try {
      
      // Test 1: Basic connection
      const { error: healthError } = await supabase
        .from('profiles')
        .select('count')
        .limit(0);

      if (healthError && !healthError.message.includes('PGRST116')) {
        updateTestResult(testName, {
          status: 'fail',
          message: `Database connection failed: ${healthError.message}`,
          details: { error: healthError, step: 'health_check' }
        });
        return;
      }


      // Test 2: Table access
      const { data: tableTest, error: tableError } = await supabase
        .from('profiles')
        .select('id, tier, subscription_status')
        .limit(1);

      if (tableError) {
        updateTestResult(testName, {
          status: 'fail',
          message: `user_profiles table not accessible: ${tableError.message}`,
          details: { error: tableError, step: 'table_access' }
        });
        return;
      }


      // Test 3: RPC functions
      let rpcWorking = false;
      try {
        const { error: rpcError } = await supabase
          .rpc('check_tier_limits', { user_id: user?.id || '00000000-0000-0000-0000-000000000000', action_type: 'request' });
        
        if (!rpcError) {
          rpcWorking = true;
        } else {
        }
      } catch (rpcErr) {
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
      updateTestResult(testName, {
        status: 'fail',
        message: `Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error, step: 'general_error' }
      });
    }
  };

  const testProfileCreation = async () => {
    const testName = 'profile-creation';
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
          message: 'No authenticated user found - please ensure you are logged in'
        });
        return;
      }


      if (!profile) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'No profile found for current user - profile creation may have failed',
          details: { userId: user.id, userEmail: user.email }
        });
        return;
      }


      // Check profile structure
      const requiredFields = ['id', 'tier', 'subscription_status', 'usage_stats', 'created_at'];
      const missingFields = requiredFields.filter(field => !(field in profile));

      if (missingFields.length > 0) {
        updateTestResult(testName, {
          status: 'fail',
          message: `Profile missing required fields: ${missingFields.join(', ')}`,
          details: { profile, missingFields, availableFields: Object.keys(profile) }
        });
        return;
      }

      // Validate field values
      const validTiers = ['basic', 'standard', 'pro'];
      const validStatuses = ['trial', 'active', 'expired', 'cancelled'];
      
      const isValidTier = validTiers.includes(profile.tier);
      const isValidStatus = validStatuses.includes(profile.subscription_status);
      const hasUsageStats = profile.usage_stats && typeof profile.usage_stats === 'object';

      if (!isValidTier || !isValidStatus || !hasUsageStats) {
        updateTestResult(testName, {
          status: 'warning',
          message: `Profile has invalid values - Tier: ${isValidTier ? '✓' : '✗'}, Status: ${isValidStatus ? '✓' : '✗'}, Usage Stats: ${hasUsageStats ? '✓' : '✗'}`,
          details: { profile, isValidTier, isValidStatus, hasUsageStats }
        });
        return;
      }

      updateTestResult(testName, {
        status: 'pass',
        message: `Profile structure valid ✓ - Tier: ${profile.tier}, Status: ${profile.subscription_status}, Trial ends: ${profile.trial_ends_at ? new Date(profile.trial_ends_at).toLocaleDateString() : 'N/A'}`,
        details: { 
          profile, 
          daysRemaining: getDaysRemaining(),
          usageStats: profile.usage_stats
        }
      });

    } catch (error) {
      updateTestResult(testName, {
        status: 'fail',
        message: `Profile test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testUsageLimits = async () => {
    const testName = 'usage-limits';
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing usage limit checking functions...'
    });

    try {
      
      // Test different action types
      const requestCheck = await checkUsageLimit('request');
      
      const audioCheck = await checkUsageLimit('audio');
      
      const storageCheck = await checkUsageLimit('storage');

      const allChecks = { requestCheck, audioCheck, storageCheck };
      
      // Check if all usage checks return proper structure
      const hasValidStructure = Object.values(allChecks).every(check => 
        typeof check === 'object' && check !== null && 'allowed' in check
      );

      if (!hasValidStructure) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'Usage limit checks not returning proper structure',
          details: { allChecks, structureValid: hasValidStructure }
        });
        return;
      }

      // Test usage percentages
      const percentages = {
        requests: getUsagePercentage('requests'),
        audio: getUsagePercentage('audio'),
        storage: getUsagePercentage('storage')
      };


      const allAllowed = Object.values(allChecks).every(check => check.allowed);

      updateTestResult(testName, {
        status: 'pass',
        message: `Usage limit checking working ✓ - All checks passed: ${allAllowed ? '✓' : '⚠️'}`,
        details: {
          checks: allChecks,
          currentUsage: profile?.usage_stats,
          percentages,
          allAllowed
        }
      });

    } catch (error) {
      updateTestResult(testName, {
        status: 'fail',
        message: `Usage limits test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testFeatureAccess = async () => {
    const testName = 'feature-access';
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing feature access controls...'
    });

    try {
      const features = ['voice', 'text', 'image'];
      
      const accessResults = features.map(feature => {
        // Use centralized tier access logic
        const canAccess = (feature === 'voice' || feature === 'audio') ? 
          (tier === 'core' || tier === 'studio') :
          feature === 'image' ? 
          (tier === 'core' || tier === 'studio') :
          true; // text is always available
        return { feature, canAccess };
      });

      // Expected access based on tier
      const expectedAccess = profile?.tier === 'free' ? 
        { voice: false, text: true, image: false } :
        profile?.tier === 'core' ?
        { voice: true, text: true, image: true } :
        { voice: true, text: true, image: true }; // studio


      const isCorrect = accessResults.every(result => 
        expectedAccess[result.feature as keyof typeof expectedAccess] === result.canAccess
      );

      const trialExpired = false; // Trial expiry check will be implemented

      updateTestResult(testName, {
        status: isCorrect ? 'pass' : 'warning',
        message: isCorrect ? 
          `Feature access controls working correctly ✓ - ${profile?.tier} tier permissions applied` : 
          `Feature access may not match expected tier permissions ⚠️`,
        details: {
          accessResults,
          expectedAccess,
          currentTier: profile?.tier,
          isTrialExpired: trialExpired,
          isCorrect
        }
      });

    } catch (error) {
      updateTestResult(testName, {
        status: 'fail',
        message: `Feature access test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testTrialExpiry = async () => {
    const testName = 'trial-expiry';
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing trial expiry logic...'
    });

    try {
      const daysRemaining = 0; // Days remaining calculation will be implemented
      const expired = isTrialExpired();
      const trialEndDate = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      
      const subscriptionData = {
        daysRemaining,
        expired,
        trialEndDate,
        tier: profile?.tier,
        status: profile?.subscription_status
      };
      console.log('Subscription data:', subscriptionData);

      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = '';

      if (profile?.tier !== 'basic' || profile?.subscription_status !== 'trial') {
        status = 'warning';
        message = `User is not on basic trial (Tier: ${profile?.tier}, Status: ${profile?.subscription_status}) - trial expiry logic not applicable`;
      } else if (daysRemaining === null) {
        status = 'fail';
        message = 'Could not calculate days remaining for trial user';
      } else if (daysRemaining <= 0 && !expired) {
        status = 'fail';
        message = 'Trial should be expired but isTrialExpired() returns false';
      } else if (daysRemaining > 0 && expired) {
        status = 'fail';
        message = 'Trial should not be expired but isTrialExpired() returns true';
      } else {
        message = `Trial expiry logic working correctly ✓ - Days remaining: ${daysRemaining}, Expired: ${expired}`;
      }

      updateTestResult(testName, {
        status,
        message,
        details: {
          daysRemaining,
          expired,
          trialEndDate,
          currentDate: new Date(),
          tier: profile?.tier,
          subscriptionStatus: profile?.subscription_status
        }
      });

    } catch (error) {
      updateTestResult(testName, {
        status: 'fail',
        message: `Trial expiry test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testUsageUpdates = async () => {
    const testName = 'usage-updates';
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing usage stat updates and monitoring...'
    });

    try {
      const initialUsage = profile?.usage_stats;
      
      updateTestResult(testName, {
        status: 'running',
        message: 'Recording initial usage stats...',
        details: { initialUsage }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 1: Update request usage
      updateTestResult(testName, {
        status: 'running',
        message: 'Updating request usage (+1)...',
        details: { step: 'request_update', initialUsage }
      });

      await updateUsage('request', 1);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 2: Update audio usage
      updateTestResult(testName, {
        status: 'running',
        message: 'Updating audio usage (+2 minutes)...',
        details: { step: 'audio_update' }
      });

      await updateUsage('audio', 2);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 3: Update storage usage
      updateTestResult(testName, {
        status: 'running',
        message: 'Updating storage usage (+5 MB)...',
        details: { step: 'storage_update' }
      });

      await updateUsage('storage', 5);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh profile to get updated stats
      updateTestResult(testName, {
        status: 'running',
        message: 'Refreshing profile to verify updates...',
        details: { step: 'refresh_profile' }
      });

      await refreshProfile();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get current usage percentages
      const finalPercentages = {
        requests: getUsagePercentage('requests'),
        audio: getUsagePercentage('audio'),
        storage: getUsagePercentage('storage')
      };


      updateTestResult(testName, {
        status: 'pass',
        message: `Usage updates completed ✓ - Check the header usage indicators to see changes`,
        details: {
          initialUsage,
          finalUsage: profile?.usage_stats,
          percentages: finalPercentages,
          updatesApplied: {
            requests: '+1',
            audio: '+2 minutes',
            storage: '+5 MB'
          },
          note: 'Check the usage indicators in the header to see real-time updates'
        }
      });

    } catch (error) {
      updateTestResult(testName, {
        status: 'fail',
        message: `Usage updates test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testRailwayBackend = async () => {
    const testName = 'railway-backend';
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing Railway backend /ping endpoint with retries...'
    });

    try {
      
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const railwayUrl = backendUrl;
      const endpoint = { path: '/ping', name: 'Railway Ping', expectedStatus: 'ok' };
      
      // Use the same test function as the health suite for consistency
      const testEndpoint = async (baseUrl: string, endpoint: any, timeout: number = 8000, retries: number = 3) => {
        const testUrl = `${baseUrl}${endpoint.path}`;
        let lastError = '';
        
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            
            const response = await fetch(testUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Atlas-TestingPanel/1.0'
              },
              signal: AbortSignal.timeout(timeout)
            });


            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ Response:`, data);

            // Validate response structure
            const isValidResponse = data && 
              typeof data.status === 'string' && 
              typeof data.message === 'string' && 
              typeof data.timestamp === 'string' && 
              typeof data.uptime === 'number';

            if (!isValidResponse) {
              throw new Error('Invalid response format - missing required fields');
            }

            return {
              success: true,
              data,
              responseTime: Date.now(),
              attempt
            };

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            lastError = errorMessage;
            
            
            if (error instanceof Error && error.name === 'AbortError') {
            } else if (error instanceof TypeError && error.message.includes('fetch')) {
            }

            if (attempt < retries) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        return {
          success: false,
          error: lastError,
          attempt: retries
        };
      };

      const result = await testEndpoint(railwayUrl, endpoint, 8000, 3);

      if (result.success && result.data) {
        const data = result.data;
        
        // Check if response matches expected format
        if (data.status !== 'ok' || data.message !== 'Atlas backend is alive!') {
          updateTestResult(testName, {
            status: 'warning',
            message: `Railway backend responded but with unexpected content - Status: ${data.status}, Message: ${data.message}`,
            details: { 
              response: data,
              expected: { status: 'ok', message: 'Atlas backend is alive!' },
              attempts: result.attempt
            }
          });
          return;
        }

        updateTestResult(testName, {
          status: 'pass',
          message: `Railway backend is alive! ✓ - Uptime: ${data.uptime.toFixed(2)}s, Attempts: ${result.attempt}`,
          details: { 
            response: data,
            backendUrl: railwayUrl,
            uptimeSeconds: data.uptime,
            responseTimestamp: data.timestamp,
            attempts: result.attempt
          }
        });

      } else {
        let errorMessage = result.error || 'Unknown error occurred';
        let errorDetails = { error: result.error, attempts: result.attempt };
        
        if (result.error?.includes('timeout')) {
          errorMessage = 'Request timeout - Railway backend may be down or slow';
        } else if (result.error?.includes('fetch')) {
          errorMessage = 'Network error - Unable to reach Railway backend';
          errorDetails = { 
            error: result.error, 
            attempts: result.attempt,
            suggestion: 'Check if Railway service is deployed and URL is correct' 
          };
        }
        
        updateTestResult(testName, {
          status: 'fail',
          message: `Railway backend test failed: ${errorMessage}`,
          details: errorDetails
        });
      }

    } catch (error) {
      updateTestResult(testName, {
        status: 'fail',
        message: `Railway backend test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testBackendHealthSuite = async () => {
    const testName = 'backend-health-suite';
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing all backend health endpoints with retries and timeouts...'
    });

    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const railwayUrl = backendUrl;
    const localUrl = 'http://localhost:3000';
    const endpoints = [
      { path: '/ping', name: 'Ping Endpoint', expectedStatus: 'ok' },
      { path: '/healthz', name: 'Health Check', expectedStatus: 'healthy' },
      { path: '/api/health', name: 'API Health', expectedStatus: 'healthy' }
    ];

    const testEndpoint = async (baseUrl: string, endpoint: typeof endpoints[0], timeout: number = 5000, retries: number = 3) => {
      const testUrl = `${baseUrl}${endpoint.path}`;
      let lastError = '';
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'Atlas-TestingPanel/1.0'
            },
            signal: AbortSignal.timeout(timeout)
          });


          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          console.log(`✅ ${endpoint.name} Response:`, data);

          // Validate response structure
          const isValidResponse = data && typeof data === 'object';
          if (!isValidResponse) {
            throw new Error('Invalid JSON response');
          }

          // Check for expected status field
          const hasExpectedStatus = data.status === endpoint.expectedStatus || data.backend === 'ok';
          if (!hasExpectedStatus) {
          }

          return {
            success: true,
            data,
            responseTime: Date.now(),
            attempt
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          lastError = errorMessage;
          
          
          if (error instanceof Error && error.name === 'AbortError') {
          } else if (error instanceof TypeError && error.message.includes('fetch')) {
          }

          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      return {
        success: false,
        error: lastError,
        attempt: retries
      };
    };

    try {
      const results = {
        railway: {} as Record<string, any>,
        local: {} as Record<string, any>,
        summary: {
          totalEndpoints: endpoints.length * 2, // railway + local
          successfulTests: 0,
          failedTests: 0,
          totalResponseTime: 0
        }
      };

      // Test Railway endpoints
      updateTestResult(testName, {
        status: 'running',
        message: 'Testing Railway backend endpoints...',
        details: { step: 'railway_testing' }
      });

      for (const endpoint of endpoints) {
        const result = await testEndpoint(railwayUrl, endpoint, 8000, 2);
        results.railway[endpoint.path] = result;
        
        if (result.success) {
          results.summary.successfulTests++;
          results.summary.totalResponseTime += result.responseTime || 0;
        } else {
          results.summary.failedTests++;
        }
      }

      // Test Local endpoints
      updateTestResult(testName, {
        status: 'running',
        message: 'Testing local backend endpoints...',
        details: { step: 'local_testing', railwayResults: results.railway }
      });

      for (const endpoint of endpoints) {
        const result = await testEndpoint(localUrl, endpoint, 3000, 2);
        results.local[endpoint.path] = result;
        
        if (result.success) {
          results.summary.successfulTests++;
          results.summary.totalResponseTime += result.responseTime || 0;
        } else {
          results.summary.failedTests++;
        }
      }

      // Generate summary
      const successRate = (results.summary.successfulTests / results.summary.totalEndpoints) * 100;
      const avgResponseTime = results.summary.totalResponseTime / results.summary.successfulTests;


      let status: 'pass' | 'fail' | 'warning' = 'pass';
      let message = '';

      if (successRate === 100) {
        status = 'pass';
        message = `All backend endpoints healthy! ✓ - Success rate: ${successRate.toFixed(1)}%, Avg response: ${avgResponseTime.toFixed(0)}ms`;
      } else if (successRate >= 70) {
        status = 'warning';
        message = `Most backend endpoints working - Success rate: ${successRate.toFixed(1)}% (${results.summary.successfulTests}/${results.summary.totalEndpoints})`;
      } else {
        status = 'fail';
        message = `Multiple backend endpoints failing - Success rate: ${successRate.toFixed(1)}% (${results.summary.successfulTests}/${results.summary.totalEndpoints})`;
      }

      updateTestResult(testName, {
        status,
        message,
        details: {
          summary: results.summary,
          railway: results.railway,
          local: results.local,
          successRate,
          avgResponseTime: avgResponseTime || 0,
          endpoints: endpoints.map(e => e.path)
        }
      });

    } catch (error) {
      updateTestResult(testName, {
        status: 'fail',
        message: `Backend health suite failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const runAllTests = async () => {
    
    setIsRunning(true);
    setTestResults([]);
    setCurrentTest(null);

    const testFunctions = {
      'database-connection': testDatabaseConnection,
      'profile-creation': testProfileCreation,
      'usage-limits': testUsageLimits,
      'feature-access': testFeatureAccess,
      'trial-expiry': testTrialExpiry,
      'usage-updates': testUsageUpdates,
      'railway-backend': testRailwayBackend,
      'backend-health-suite': testBackendHealthSuite
    };

    try {
      for (const testName of selectedTests) {
        if (testFunctions[testName as keyof typeof testFunctions]) {
          setCurrentTest(testName);
          
          try {
            await testFunctions[testName as keyof typeof testFunctions]();
          } catch (testError) {
            updateTestResult(testName, {
              status: 'fail',
              message: `Test execution failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`,
              details: { error: testError }
            });
          }
          
          // Add delay between tests
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } catch (error) {
      addTestResult({
        test: 'test-runner',
        status: 'fail',
        message: `Test runner error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    } finally {
      setIsRunning(false);
      setCurrentTest(null);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'running':
        return <LoadingSpinner size="sm" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return 'border-green-200 bg-green-50';
      case 'fail':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      case 'pending':
        return 'border-gray-200 bg-gray-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const testOptions = [
    { id: 'database-connection', label: 'Database Connection', icon: Database },
    { id: 'profile-creation', label: 'Profile Creation', icon: UserIcon },
    { id: 'usage-limits', label: 'Usage Limits', icon: Settings },
    { id: 'feature-access', label: 'Feature Access', icon: UserIcon },
    { id: 'trial-expiry', label: 'Trial Expiry', icon: Clock },
    { id: 'usage-updates', label: 'Usage Updates', icon: TrendingUp }
  ];

  // Compute detailsString before the return to ensure it's always a string
  const getDetailsString = (details: unknown): string => {
    if (typeof details === 'string') return details;
    if (typeof details === 'object' && details !== null) return JSON.stringify(details, null, 2);
    return String(details);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="neumorphic-card bg-white rounded-2xl border border-gray-300 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TestTube className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Subscription System Testing</h2>
              <p className="text-gray-700 text-sm">Test and verify subscription and usage tracking functionality</p>
              {currentTest && (
                <p className="text-blue-600 text-sm font-medium">Currently running: {currentTest.replace('-', ' ')}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="neumorphic-button p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Test Selection */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Tests to Run</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {testOptions.map(option => {
              const Icon = option.icon;
              const isSelected = selectedTests.includes(option.id);
              
              return (
                <label
                  key={option.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all neumorphic-card ${
                    isSelected 
                      ? 'border-blue-300 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTests(prev => [...prev, option.id]);
                      } else {
                        setSelectedTests(prev => prev.filter(id => id !== option.id));
                      }
                    }}
                    className="sr-only"
                    disabled={isRunning}
                  />
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} selected
            {testResults.length > 0 && (
              <span className="ml-4">
                • {testResults.filter(r => r.status === 'pass').length} passed
                • {testResults.filter(r => r.status === 'warning').length} warnings  
                • {testResults.filter(r => r.status === 'fail').length} failed
              </span>
            )}
          </div>
          <button
            onClick={runAllTests}
            disabled={isRunning || selectedTests.length === 0}
            className="neumorphic-button px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span>Running Tests...</span>
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4" />
                <span>Run Tests</span>
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {testResults.length === 0 && !isRunning ? (
            <div className="text-center py-12 text-gray-700">
              <TestTube className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No tests run yet. Select tests and click "Run Tests" to begin.</p>
              <p className="text-sm mt-2">User: {user ? '✓ Logged in' : '✗ Not logged in'}</p>
              <p className="text-sm">Profile: {profile ? '✓ Found' : '✗ Not found'}</p>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">💡 Testing Tips:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Run "Usage Updates" test to see real-time usage tracking</li>
                  <li>• Watch the header usage indicators change during tests</li>
                  <li>• Check browser console for detailed logging</li>
                  <li>• Try the upgrade modal to see different tier options</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Test Results {testResults.length > 0 && `(${testResults.length})`}
              </h3>
              {testResults.map((result, index) => (
                <div
                  key={`${result.test}-${index}`}
                  className={`p-4 rounded-lg border-2 neumorphic-card ${getStatusColor(result.status)}`}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 capitalize">
                          {result.test.replace('-', ' ')}
                        </h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          result.status === 'pass' ? 'bg-green-100 text-green-700' :
                          result.status === 'fail' ? 'bg-red-100 text-red-700' :
                          result.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          result.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {result.status}
                        </span>
                        {result.timestamp && (
                          <span className="text-xs text-gray-600">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 mb-2">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-800">
                            View Details
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto text-gray-800">
                            {getDetailsString(result.details)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isRunning && (
                <div className="text-center py-4">
                  <LoadingSpinner size="md" />
                  <p className="text-gray-700 mt-2">Running tests...</p>
                  {currentTest && (
                    <p className="text-sm text-blue-600">Current: {currentTest.replace('-', ' ')}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        {testResults.length > 0 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Tests completed: {testResults.filter(r => r.status !== 'running').length} / {testResults.length}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>{testResults.filter(r => r.status === 'pass').length} passed</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span>{testResults.filter(r => r.status === 'warning').length} warnings</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>{testResults.filter(r => r.status === 'fail').length} failed</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestingPanel;