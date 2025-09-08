import type { User } from '@supabase/supabase-js';
import { useCallback, useState } from 'react';
import type { UserProfile } from '../../../types/subscription';

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

export const useTestRunner = ({ user, profile }: UseTestRunnerProps) => {
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

  const runAllTests = useCallback(async (testFunctions: Record<string, TestFunction>) => {
    console.log('🧪 --- Starting all tests ---');
    console.log('🧪 Selected tests:', selectedTests);
    console.log('🧪 User:', user?.id);
    console.log('🧪 Profile:', profile);
    
    setIsRunning(true);
    setTestResults([]);
    setCurrentTest(null);

    try {
      for (const testName of selectedTests) {
        if (testFunctions[testName]) {
          console.log(`🧪 Running ${testName} test...`);
          setCurrentTest(testName);
          
          try {
            await testFunctions[testName]();
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
