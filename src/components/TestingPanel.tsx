import React, { useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../types/subscription';
import { supabase } from '../lib/supabase';
import { useSubscription } from '../hooks/useSubscription';
import { 
  TestTube, 
  Database, 
  User as UserIcon, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  TrendingUp
} from 'lucide-react';
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
    'usage-updates'
  ]);

  const {
    checkUsageLimit,
    updateUsage,
    refreshProfile,
    getDaysRemaining,
    isTrialExpired,
    canAccessFeature,
    getUsagePercentage
  } = useSubscription(user);

  const addTestResult = useCallback((result: TestResult) => {
    const resultWithTimestamp = {
      ...result,
      timestamp: new Date().toISOString()
    };
    console.log('🧪 Adding test result:', resultWithTimestamp);
    setTestResults(prev => {
      const newResults = [...prev, resultWithTimestamp];
      console.log('🧪 New results array length:', newResults.length);
      return newResults;
    });
  }, []);

  const updateTestResult = useCallback((testName: string, updates: Partial<TestResult>) => {
    console.log('🧪 Updating test result for:', testName, 'with updates:', updates);
    setTestResults(prev => {
      const newResults = prev.map(result => 
        result.test === testName ? { ...result, ...updates, timestamp: new Date().toISOString() } : result
      );
      console.log('🧪 Updated results array length:', newResults.length);
      return newResults;
    });
  }, []);

  const testDatabaseConnection = async () => {
    const testName = 'database-connection';
    console.log('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing database connection and table access...'
    });

    try {
      console.log('🧪 Testing basic Supabase connection...');
      
      // Test 1: Basic connection
      const { error: healthError } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(0);

      if (healthError && !healthError.message.includes('PGRST116')) {
        console.error('🧪 Health check failed:', healthError);
        updateTestResult(testName, {
          status: 'fail',
          message: `Database connection failed: ${healthError.message}`,
          details: { error: healthError, step: 'health_check' }
        });
        return;
      }

      console.log('🧪 Basic connection OK, testing table access...');

      // Test 2: Table access
      const { data: tableTest, error: tableError } = await supabase
        .from('user_profiles')
        .select('id, tier, subscription_status')
        .limit(1);

      if (tableError) {
        console.error('🧪 Table access failed:', tableError);
        updateTestResult(testName, {
          status: 'fail',
          message: `user_profiles table not accessible: ${tableError.message}`,
          details: { error: tableError, step: 'table_access' }
        });
        return;
      }

      console.log('🧪 Table access OK, testing RPC functions...');

      // Test 3: RPC functions
      let rpcWorking = false;
      try {
        const { error: rpcError } = await supabase
          .rpc('check_tier_limits', { user_id: user?.id || '00000000-0000-0000-0000-000000000000', action_type: 'request' });
        
        if (!rpcError) {
          rpcWorking = true;
          console.log('🧪 RPC functions working');
        } else {
          console.warn('🧪 RPC functions not working:', rpcError);
        }
      } catch (rpcErr) {
        console.warn('🧪 RPC test failed:', rpcErr);
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
      console.error('🧪 Database connection test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error, step: 'general_error' }
      });
    }
  };

  const testProfileCreation = async () => {
    const testName = 'profile-creation';
    console.log('🧪 Running test:', testName);
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

      console.log('🧪 User found:', user.id);

      if (!profile) {
        updateTestResult(testName, {
          status: 'fail',
          message: 'No profile found for current user - profile creation may have failed',
          details: { userId: user.id, userEmail: user.email }
        });
        return;
      }

      console.log('🧪 Profile found:', profile);

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
      console.error('🧪 Profile creation test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Profile test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testUsageLimits = async () => {
    const testName = 'usage-limits';
    console.log('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing usage limit checking functions...'
    });

    try {
      console.log('🧪 Testing usage limit checks...');
      
      // Test different action types
      const requestCheck = await checkUsageLimit('request');
      console.log('🧪 Request check result:', requestCheck);
      
      const audioCheck = await checkUsageLimit('audio');
      console.log('🧪 Audio check result:', audioCheck);
      
      const storageCheck = await checkUsageLimit('storage');
      console.log('🧪 Storage check result:', storageCheck);

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

      console.log('🧪 Usage percentages:', percentages);

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
      console.error('🧪 Usage limits test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Usage limits test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testFeatureAccess = async () => {
    const testName = 'feature-access';
    console.log('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing feature access controls...'
    });

    try {
      const features = ['voice', 'text', 'image'];
      
      const accessResults = features.map(feature => {
        const canAccess = canAccessFeature(feature);
        console.log(`🧪 Feature ${feature} access:`, canAccess);
        return { feature, canAccess };
      });

      // Expected access based on tier
      const expectedAccess = profile?.tier === 'basic' ? 
        { voice: true, text: true, image: false } :
        profile?.tier === 'standard' ?
        { voice: true, text: true, image: true } :
        { voice: true, text: true, image: true }; // pro

      console.log('🧪 Expected access for tier', profile?.tier, ':', expectedAccess);

      const isCorrect = accessResults.every(result => 
        expectedAccess[result.feature as keyof typeof expectedAccess] === result.canAccess
      );

      const trialExpired = isTrialExpired();
      console.log('🧪 Trial expired:', trialExpired);

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
      console.error('🧪 Feature access test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Feature access test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testTrialExpiry = async () => {
    const testName = 'trial-expiry';
    console.log('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing trial expiry logic...'
    });

    try {
      const daysRemaining = getDaysRemaining();
      const expired = isTrialExpired();
      const trialEndDate = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      
      console.log('🧪 Trial data:', {
        daysRemaining,
        expired,
        trialEndDate,
        tier: profile?.tier,
        status: profile?.subscription_status
      });

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
      console.error('🧪 Trial expiry test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Trial expiry test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const testUsageUpdates = async () => {
    const testName = 'usage-updates';
    console.log('🧪 Running test:', testName);
    setCurrentTest(testName);
    
    addTestResult({
      test: testName,
      status: 'running',
      message: 'Testing usage stat updates and monitoring...'
    });

    try {
      const initialUsage = profile?.usage_stats;
      console.log('🧪 Initial usage stats:', initialUsage);
      
      updateTestResult(testName, {
        status: 'running',
        message: 'Recording initial usage stats...',
        details: { initialUsage }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 1: Update request usage
      console.log('🧪 Testing request usage update...');
      updateTestResult(testName, {
        status: 'running',
        message: 'Updating request usage (+1)...',
        details: { step: 'request_update', initialUsage }
      });

      await updateUsage('request', 1);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 2: Update audio usage
      console.log('🧪 Testing audio usage update...');
      updateTestResult(testName, {
        status: 'running',
        message: 'Updating audio usage (+2 minutes)...',
        details: { step: 'audio_update' }
      });

      await updateUsage('audio', 2);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test 3: Update storage usage
      console.log('🧪 Testing storage usage update...');
      updateTestResult(testName, {
        status: 'running',
        message: 'Updating storage usage (+5 MB)...',
        details: { step: 'storage_update' }
      });

      await updateUsage('storage', 5);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh profile to get updated stats
      console.log('🧪 Refreshing profile to get updated stats...');
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

      console.log('🧪 Final usage percentages:', finalPercentages);

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
      console.error('🧪 Usage updates test failed:', error);
      updateTestResult(testName, {
        status: 'fail',
        message: `Usage updates test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  };

  const runAllTests = async () => {
    console.log('🧪 --- Starting all tests ---');
    console.log('🧪 Selected tests:', selectedTests);
    console.log('🧪 User:', user?.id);
    console.log('🧪 Profile:', profile);
    
    setIsRunning(true);
    setTestResults([]);
    setCurrentTest(null);

    const testFunctions = {
      'database-connection': testDatabaseConnection,
      'profile-creation': testProfileCreation,
      'usage-limits': testUsageLimits,
      'feature-access': testFeatureAccess,
      'trial-expiry': testTrialExpiry,
      'usage-updates': testUsageUpdates
    };

    try {
      for (const testName of selectedTests) {
        if (testFunctions[testName as keyof typeof testFunctions]) {
          console.log(`🧪 Running ${testName} test...`);
          setCurrentTest(testName);
          
          try {
            await testFunctions[testName as keyof typeof testFunctions]();
            console.log(`🧪 Completed ${testName} test`);
          } catch (testError) {
            console.error(`🧪 Error in ${testName} test:`, testError);
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
      console.error('🧪 Error during test execution:', error);
      addTestResult({
        test: 'test-runner',
        status: 'fail',
        message: `Test runner error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    } finally {
      setIsRunning(false);
      setCurrentTest(null);
      console.log('🧪 --- All tests finished ---');
      console.log('🧪 Final test results count:', testResults.length);
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