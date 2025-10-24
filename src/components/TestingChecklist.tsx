import { Check, Mail, MessageSquare, Play, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';
import { mailerService } from '../services/mailerService';
import { errorLogger } from '../lib/errorLogger';
import { Sentry } from '../lib/sentry';

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  error?: string;
  duration?: number;
  timestamp?: string;
}

interface TestingChecklistProps {
  className?: string;
}

const TestingChecklist: React.FC<TestingChecklistProps> = ({ className = '' }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testEmail, setTestEmail] = useState('test@example.com');

  const tests = [
    {
      id: 'welcome-email',
      name: 'Welcome Email Flow',
      description: 'Test welcome email sending',
      icon: <Mail className="w-4 h-4" />,
      run: async () => {
        const result = await mailerService.testEmailFlow(
          { email: testEmail, name: 'Test User' },
          'welcome'
        );
        if (!result.success) {
          throw new Error(result.error || 'Welcome email test failed');
        }
      }
    },
    {
      id: 'upgrade-nudge',
      name: 'Upgrade Nudge Email',
      description: 'Test upgrade nudge email',
      icon: <Mail className="w-4 h-4" />,
      run: async () => {
        const result = await mailerService.testEmailFlow(
          { email: testEmail, name: 'Test User' },
          'upgrade_nudge'
        );
        if (!result.success) {
          throw new Error(result.error || 'Upgrade nudge test failed');
        }
      }
    },
    {
      id: 'inactivity-reminder',
      name: 'Inactivity Reminder',
      description: 'Test inactivity reminder email',
      icon: <Mail className="w-4 h-4" />,
      run: async () => {
        const result = await mailerService.testEmailFlow(
          { email: testEmail, name: 'Test User' },
          'inactivity_reminder'
        );
        if (!result.success) {
          throw new Error(result.error || 'Inactivity reminder test failed');
        }
      }
    },
    {
      id: 'weekly-summary',
      name: 'Weekly Summary Email',
      description: 'Test weekly summary email',
      icon: <Mail className="w-4 h-4" />,
      run: async () => {
        const result = await mailerService.testEmailFlow(
          { email: testEmail, name: 'Test User' },
          'weekly_summary'
        );
        if (!result.success) {
          throw new Error(result.error || 'Weekly summary test failed');
        }
      }
    },
    {
      id: 'error-logging',
      name: 'Error Logging System',
      description: 'Test error logging functionality',
      icon: <RefreshCw className="w-4 h-4" />,
      run: async () => {
        // Test error logging
        const testError = new Error('Test error for logging');
        const errorId = errorLogger.log(testError, {
          component: 'TestingChecklist',
          action: 'test_error_logging',
        });
        
        if (!errorId) {
          throw new Error('Error logging failed');
        }

        // Test Sentry integration
        Sentry.captureException(testError, {
          test: true,
          component: 'TestingChecklist',
        });
      }
    },
    {
      id: 'sentry-integration',
      name: 'Sentry Integration',
      description: 'Test Sentry error monitoring',
      icon: <RefreshCw className="w-4 h-4" />,
      run: async () => {
        // Test Sentry message capture
        const messageId = Sentry.captureMessage('Test message from TestingChecklist', 'info', {
          test: true,
          component: 'TestingChecklist',
        });
        
        if (!messageId) {
          throw new Error('Sentry message capture failed');
        }

        // Test Sentry user context
        Sentry.setUser({
          id: 'test-user-id',
          email: testEmail,
          username: 'testuser',
        });
      }
    },
    {
      id: 'mock-streaming',
      name: 'Mock AI Streaming',
      description: 'Test AI response streaming (mock)',
      icon: <MessageSquare className="w-4 h-4" />,
      run: async () => {
        // Mock streaming test
        const chunks: string[] = [];
        const mockResponse = 'This is a mock streaming response from AI.';
        const words = mockResponse.split(' ');
        
        for (const word of words) {
          await new Promise(resolve => setTimeout(resolve, 50));
          chunks.push(word + ' ');
        }
        
        if (chunks.length === 0) {
          throw new Error('No chunks received from streaming');
        }
        
        const fullResponse = chunks.join('').trim();
        if (fullResponse !== mockResponse) {
          throw new Error('Streaming response mismatch');
        }
      }
    }
  ];

  const runTest = async (test: typeof tests[0]) => {
    const testResult: TestResult = {
      id: test.id,
      name: test.name,
      status: 'running',
      timestamp: new Date().toISOString(),
    };

    setTestResults(prev => {
      const filtered = prev.filter(r => r.id !== test.id);
      return [...filtered, testResult];
    });

    const startTime = Date.now();

    try {
      await test.run();
      
      const duration = Date.now() - startTime;
      setTestResults(prev => prev.map(r => 
        r.id === test.id 
          ? { ...r, status: 'passed' as const, duration, timestamp: new Date().toISOString() }
          : r
      ));
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setTestResults(prev => prev.map(r => 
        r.id === test.id 
          ? { ...r, status: 'failed' as const, error: errorMessage, duration, timestamp: new Date().toISOString() }
          : r
      ));

      // Log the test error
      errorLogger.log(error, {
        component: 'TestingChecklist',
        action: 'test_failed',
        testId: test.id,
        testName: test.name,
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    for (const test of tests) {
      await runTest(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 border border-gray-300 rounded" />;
      case 'running':
        return <div className="w-4 h-4 border-2 border-atlas-sage border-t-transparent rounded-full animate-spin" />;
      case 'passed':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'running':
        return 'text-atlas-sage';
      case 'passed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
    }
  };

  const passedTests = testResults.filter(r => r.status === 'passed').length;
  const failedTests = testResults.filter(r => r.status === 'failed').length;
  const totalTests = tests.length;

  return (
    <div className={`bg-gray-800 text-white p-6 rounded-lg ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Play className="w-6 h-6 text-green-400" />
        <h2 className="text-xl font-bold">🧪 Testing Checklist</h2>
      </div>

      {/* Test Email Input */}
      <div className="mb-6 p-4 bg-gray-700 rounded-lg">
        <label htmlFor="test-email" className="block text-sm font-medium mb-2">
          Test Email Address
        </label>
        <input
          id="test-email"
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="test@example.com"
          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-atlas-sage"
        />
      </div>

      {/* Test Controls */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-4 py-2 bg-atlas-sage hover:bg-atlas-success disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
        <button
          onClick={clearResults}
          disabled={isRunning}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm transition-colors"
        >
          Clear Results
        </button>
      </div>

      {/* Test Results Summary */}
      {testResults.length > 0 && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="font-medium mb-2">Test Results Summary</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">✅ Passed: {passedTests}</span>
            <span className="text-red-400">❌ Failed: {failedTests}</span>
            <span className="text-gray-400">📊 Total: {totalTests}</span>
            <span className="text-atlas-sage">
              📈 Success Rate: {totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%
            </span>
          </div>
        </div>
      )}

      {/* Individual Tests */}
      <div className="space-y-3">
        {tests.map((test) => {
          const result = testResults.find(r => r.id === test.id);
          const status = result?.status || 'pending';
          
          return (
            <div key={test.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(status)}
                <div>
                  <div className="flex items-center gap-2">
                    {test.icon}
                    <span className="font-medium">{test.name}</span>
                  </div>
                  <p className="text-sm text-gray-400">{test.description}</p>
                  {result?.error && (
                    <p className="text-sm text-red-400 mt-1">Error: {result.error}</p>
                  )}
                  {result?.duration && (
                    <p className="text-xs text-gray-500 mt-1">
                      Duration: {result.duration}ms
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${getStatusColor(status)}`}>
                  {status === 'pending' && 'Not Run'}
                  {status === 'running' && 'Running...'}
                  {status === 'passed' && 'Passed'}
                  {status === 'failed' && 'Failed'}
                </span>
                <button
                  onClick={() => runTest(test)}
                  disabled={isRunning}
                  className="px-3 py-1 bg-atlas-sage hover:bg-atlas-success disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs transition-colors"
                >
                  {status === 'running' ? 'Running...' : 'Test'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Logger Stats */}
      <div className="mt-6 p-4 bg-gray-700 rounded-lg">
        <h3 className="font-medium mb-2">Error Logger Stats</h3>
        <div className="text-sm text-gray-300">
          <p>Total Errors Logged: {errorLogger.getErrors().length}</p>
          <p>Recent Errors (24h): {errorLogger.getStats().recentErrors}</p>
          <p>Sentry Status: {Sentry.isReady() ? '✅ Ready' : '⚠️ Not Initialized'}</p>
        </div>
      </div>
    </div>
  );
};

export default TestingChecklist;
