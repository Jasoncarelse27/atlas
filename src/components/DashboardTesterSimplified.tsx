import {
  Grid3X3,
  Play,
  Sliders,
  TestTube,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import PerformanceMetrics from './DashboardTester/PerformanceMetrics';
import TestResultCard from './DashboardTester/TestResultCard';

interface DashboardTesterProps {
  onClose: () => void;
  onShowWidgets: () => void;
  onShowControlCenter: () => void;
}

interface TestResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'running' | 'pending';
  score?: number;
  maxScore?: number;
  details?: string;
  recommendations?: string[];
  duration?: number;
  timestamp?: string;
}

interface PerformanceMetricsData {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  domNodes: number;
  eventListeners: number;
  cssRules: number;
}

const DashboardTesterSimplified: React.FC<DashboardTesterProps> = ({
  onClose,
  onShowWidgets,
  onShowControlCenter
}) => {
  // const [activeTest, setActiveTest] = useState<string | null>(null); // TODO: Use for active test tracking
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetricsData | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  // Initialize performance metrics on mount
  useEffect(() => {
    runPerformanceTest();
  }, []);

  const runPerformanceTest = async () => {
    const startTime = performance.now();
    
    try {
      // Collect performance metrics with error handling
      const metrics: PerformanceMetricsData = {
        loadTime: performance.now() - startTime,
        renderTime: 0,
        memoryUsage: 0,
        domNodes: document.querySelectorAll('*').length,
        eventListeners: 0,
        cssRules: 0
      };

      // Safe memory usage check
      try {
        const memoryInfo = (performance as any).memory;
        if (memoryInfo && memoryInfo.usedJSHeapSize) {
          metrics.memoryUsage = memoryInfo.usedJSHeapSize;
        }
      } catch (e) {
      }

      // Safe CSS rules count
      try {
        metrics.cssRules = Array.from(document.styleSheets).reduce((count, sheet) => {
          try {
            return count + (sheet.cssRules?.length || 0);
          } catch {
            return count; // Cross-origin stylesheets
          }
        }, 0);
      } catch (e) {
      }

      // Measure render time
      requestAnimationFrame(() => {
        metrics.renderTime = performance.now() - startTime;
        setPerformanceMetrics(metrics);
      });
    } catch (error) {
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    // setActiveTest('all'); // TODO: Use for active test tracking

    // Simulate running tests
    const tests = [
      { id: 'performance', name: 'Performance Test', maxScore: 100 },
      { id: 'accessibility', name: 'Accessibility Test', maxScore: 100 },
      { id: 'security', name: 'Security Test', maxScore: 100 },
      { id: 'optimization', name: 'Optimization Test', maxScore: 100 }
    ];

    for (const test of tests) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate test duration
      
      const score = Math.floor(Math.random() * test.maxScore);
      const status = score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail';
      
      setTestResults(prev => ({
        ...prev,
        [test.id]: {
          id: test.id,
          name: test.name,
          status,
          score,
          maxScore: test.maxScore,
          duration: Math.floor(Math.random() * 500) + 100,
          timestamp: new Date().toISOString(),
          details: `Test completed with ${status} status`,
          recommendations: score < 80 ? ['Consider optimizing performance', 'Review configuration'] : []
        }
      }));
    }

    setIsRunningAll(false);
    // setActiveTest(null); // TODO: Use for active test tracking
  };

  const handleShowDetails = (id: string) => {
  };

  const filteredResults = selectedCategory === 'all' 
    ? Object.values(testResults)
    : Object.values(testResults).filter(result => result.status === selectedCategory);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <TestTube className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Dashboard Tester</h2>
              <p className="text-sm text-gray-400">Comprehensive testing suite for Atlas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 bg-gray-800/50 p-4 border-r border-gray-700">
            <div className="space-y-4">
              <button
                onClick={runAllTests}
                disabled={isRunningAll}
                className="w-full flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>{isRunningAll ? 'Running...' : 'Run All Tests'}</span>
              </button>

              <button
                onClick={runPerformanceTest}
                className="w-full flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Zap className="w-4 h-4" />
                <span>Performance Test</span>
              </button>

              <div className="pt-4 border-t border-gray-700">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Filter Results</h3>
                <div className="space-y-1">
                  {['all', 'pass', 'fail', 'warning'].map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCategory === category
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Quick Actions</h3>
                <button
                  onClick={onShowWidgets}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Grid3X3 className="w-4 h-4" />
                  <span>Show Widgets</span>
                </button>
                <button
                  onClick={onShowControlCenter}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Control Center</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Metrics */}
              <div className="lg:col-span-1">
                <PerformanceMetrics metrics={performanceMetrics} />
              </div>

              {/* Test Results */}
              <div className="lg:col-span-1">
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                  <h3 className="font-medium text-gray-200 mb-4">Test Results ({filteredResults.length})</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredResults.length > 0 ? (
                      filteredResults.map((result) => (
                        <TestResultCard
                          key={result.id}
                          result={result}
                          onShowDetails={handleShowDetails}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <TestTube className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No test results yet</p>
                        <p className="text-sm">Click "Run All Tests" to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTesterSimplified;
