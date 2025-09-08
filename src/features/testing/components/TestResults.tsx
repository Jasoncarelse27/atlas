import { AlertTriangle, CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import React from 'react';
import type { TestResult } from '../hooks/useTestRunner';

interface TestResultsProps {
  testResults: TestResult[];
  isRunning: boolean;
  currentTest: string | null;
  onClearResults: () => void;
}

const TestResults: React.FC<TestResultsProps> = ({
  testResults,
  isRunning,
  currentTest,
  onClearResults,
}) => {
  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200';
      case 'fail':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'running':
        return 'bg-blue-50 border-blue-200';
      case 'pending':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return 'PASSED';
      case 'fail':
        return 'FAILED';
      case 'warning':
        return 'WARNING';
      case 'running':
        return 'RUNNING';
      case 'pending':
        return 'PENDING';
      default:
        return 'UNKNOWN';
    }
  };

  const formatTestName = (testName: string) => {
    return testName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  if (testResults.length === 0 && !isRunning) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-2">
          <CheckCircle className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-gray-600">No test results yet</p>
        <p className="text-sm text-gray-500">Run tests to see results here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Test Results ({testResults.length})
        </h3>
        {testResults.length > 0 && (
          <button
            onClick={onClearResults}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear Results
          </button>
        )}
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {testResults.map((result, index) => (
          <div
            key={`${result.test}-${index}`}
            className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(result.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900">
                    {formatTestName(result.test)}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    result.status === 'pass' ? 'bg-green-100 text-green-800' :
                    result.status === 'fail' ? 'bg-red-100 text-red-800' :
                    result.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    result.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusText(result.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                {result.timestamp && (
                  <p className="text-xs text-gray-500">
                    {formatTimestamp(result.timestamp)}
                  </p>
                )}
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      View Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}

        {isRunning && currentTest && (
          <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              <div>
                <h4 className="font-medium text-gray-900">
                  Running {formatTestName(currentTest)}...
                </h4>
                <p className="text-sm text-gray-600">Please wait while the test executes</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestResults;
