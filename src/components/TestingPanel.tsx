/** REFACTORED: TestingPanel now uses modular testing components */
import { TestConfiguration, TestResults, useTestRunner } from '@/features/testing';
import { createTestFunctions } from '@/features/testing/services/testFunctions';
import type { User } from '@supabase/supabase-js';
import {
    Play,
    Square,
    TestTube,
    X
} from 'lucide-react';
import React from 'react';
import { useSubscription } from '../hooks/useSubscription';
import type { UserProfile } from '../types/subscription';
import LoadingSpinner from './LoadingSpinner';

interface TestingPanelProps {
  user: User | null;
  profile: UserProfile | null;
  onClose: () => void;
}

const TestingPanel: React.FC<TestingPanelProps> = ({ user, profile, onClose }) => {
  const {
    checkUsageLimit,
    updateUsage,
    refreshProfile,
    getDaysRemaining,
    isTrialExpired,
    canAccessFeature,
    getUsagePercentage
  } = useSubscription(user);

  const {
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
  } = useTestRunner({ user, profile });

  const testFunctions = createTestFunctions({
    user,
    profile,
    addTestResult,
    updateTestResult,
    setCurrentTest: (testName) => {
      // This is handled by the test functions themselves
    },
    checkUsageLimit,
    updateUsage,
    refreshProfile,
    getDaysRemaining,
    isTrialExpired,
    canAccessFeature,
    getUsagePercentage,
  });

  const handleRunTests = async () => {
    await runAllTests(testFunctions);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-300 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TestTube className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Testing Panel
                </h2>
                <p className="text-sm text-gray-600">
                  Comprehensive system testing and diagnostics
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Test Configuration */}
          <div className="w-1/3 border-r border-gray-200 p-6 overflow-y-auto">
            <TestConfiguration
              selectedTests={selectedTests}
              onToggleTest={toggleTestSelection}
              onSelectAll={selectAllTests}
              onDeselectAll={deselectAllTests}
            />
          </div>

          {/* Right Panel - Test Results */}
          <div className="flex-1 p-6 overflow-y-auto">
            <TestResults
              testResults={testResults}
              isRunning={isRunning}
              currentTest={currentTest}
              onClearResults={clearResults}
            />
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {selectedTests.length} tests selected
              </div>
              {testResults.length > 0 && (
                <div className="text-sm text-gray-600">
                  {testResults.filter(r => r.status === 'pass').length} passed, {' '}
                  {testResults.filter(r => r.status === 'fail').length} failed
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={clearResults}
                disabled={isRunning || testResults.length === 0}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Clear Results
              </button>
              
              <button
                onClick={handleRunTests}
                disabled={isRunning || selectedTests.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isRunning ? (
                  <LoadingSpinner size="sm" color="white" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isRunning ? 'Running Tests...' : 'Run Tests'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingPanel;
