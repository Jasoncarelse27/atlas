import type { User } from '@supabase/supabase-js';
import { useCallback, useState } from 'react';
import type { UserProfile } from '../../../types/subscription';

import { logger } from '../utils/logger';
export interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'pending';
  message: string;
  details?: unknown;
  timestamp?: string;
}

export interface TestFunction {
  (): Promise<void>;
}

export interface UseTestRunnerProps {
  user: User | null;
  profile: UserProfile | null;
}

export const __useTestRunner = ({ user, profile }: UseTestRunnerProps) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const addTestResult = useCallback((result: TestResult) => {
    const resultWithTimestamp = {
      ...result,
      timestamp: new Date().toISOString(),
    };
    logger.info('🧪 Adding test result:', resultWithTimestamp);
    setTestResults(prev => {
      const newResults = [...prev, resultWithTimestamp];
      logger.info('🧪 New results array length:', newResults.length);
      return newResults;
    });
  }, []);

  const updateTestResult = useCallback((testName: string, updates: Partial<TestResult>) => {
    logger.info('🧪 Updating test result for:', testName, 'with updates:', updates);
    setTestResults(prev => {
      const newResults = prev.map(result => 
        result.test === testName ? { ...result, ...updates, timestamp: new Date().toISOString() } : result
      );
      logger.info('🧪 Updated results array length:', newResults.length);
      return newResults;
    });
  }, []);

  const runAllTests = useCallback(async (testFunctions: Record<string, TestFunction>) => {
    logger.info('🧪 --- Starting all tests ---');
    logger.info('🧪 Selected tests:', selectedTests);
    logger.info('🧪 User:', user?.id);
    logger.info('🧪 Profile:', profile);
    
    setIsRunning(true);
    setTestResults([]);
    setCurrentTest(null);

    try {
      for (const testName of selectedTests) {
        if (testFunctions[testName]) {
          logger.info(`🧪 Running ${testName} test...`);
          setCurrentTest(testName);
          
          try {
            await testFunctions[testName]();
            logger.info(`🧪 Completed ${testName} test`);
          } catch (testError) {
            logger.error(`🧪 Error in ${testName} test:`, testError);
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
      logger.error('🧪 Error during test execution:', error);
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
  }, [selectedTests, user, profile, addTestResult, updateTestResult]);

  const clearResults = useCallback(() => {
    setTestResults([]);
  }, []);

  const toggleTestSelection = useCallback((testName: string) => {
    setSelectedTests(prev => 
      prev.includes(testName) 
        ? prev.filter(name => name !== testName)
        : [...prev, testName]
    );
  }, []);

  const selectAllTests = useCallback(() => {
    setSelectedTests([
      'database-connection',
      'profile-creation',
      'usage-limits',
      'feature-access',
      'trial-expiry',
      'usage-updates',
      'railway-backend',
      'backend-health-suite'
    ]);
  }, []);

  const deselectAllTests = useCallback(() => {
    setSelectedTests([]);
  }, []);

  return {
    testResults,
    isRunning,
    currentTest,
    selectedTests,
    addTestResult,
    updateTestResult,
    runAllTests,
    clearResults,
    toggleTestSelection,
    selectAllTests,
    deselectAllTests,
  };
};
