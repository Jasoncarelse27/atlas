import { CheckCircle2, CheckSquare, Square, TestTube } from 'lucide-react';
import React from 'react';

interface TestConfigurationProps {
  selectedTests: string[];
  onToggleTest: (testName: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const availableTests = [
  {
    id: 'database-connection',
    name: 'Database Connection',
    description: 'Test Supabase connection and table access'
  },
  {
    id: 'profile-creation',
    name: 'Profile Creation',
    description: 'Test user profile creation and updates'
  },
  {
    id: 'usage-limits',
    name: 'Usage Limits',
    description: 'Test subscription usage limits and tracking'
  },
  {
    id: 'feature-access',
    name: 'Feature Access',
    description: 'Test feature access based on subscription tier'
  },
  {
    id: 'trial-expiry',
    name: 'Trial Expiry',
    description: 'Test trial expiration logic'
  },
  {
    id: 'usage-updates',
    name: 'Usage Updates',
    description: 'Test usage counter updates'
  },
  {
    id: 'railway-backend',
    name: 'Railway Backend',
    description: 'Test Railway backend connectivity'
  },
  {
    id: 'backend-health-suite',
    name: 'Backend Health Suite',
    description: 'Comprehensive backend health checks'
  }
];

const TestConfiguration: React.FC<TestConfigurationProps> = ({
  selectedTests,
  onToggleTest,
  onSelectAll,
  onDeselectAll,
}) => {
  const allSelected = availableTests.every(test => selectedTests.includes(test.id));
  const someSelected = selectedTests.length > 0 && !allSelected;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          Test Configuration
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={onDeselectAll}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {availableTests.map((test) => {
          const isSelected = selectedTests.includes(test.id);
          
          return (
            <div
              key={test.id}
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                isSelected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => onToggleTest(test.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 mb-1">
                    {test.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {test.description}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {selectedTests.length} of {availableTests.length} tests selected
          </span>
          {someSelected && (
            <span className="text-blue-600 font-medium">
              Partial selection
            </span>
          )}
          {allSelected && (
            <span className="text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              All tests selected
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestConfiguration;
