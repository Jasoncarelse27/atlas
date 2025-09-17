import { Activity, AlertCircle, CheckCircle, Wifi, XCircle } from 'lucide-react';
import React, { useState } from 'react';

interface PingResult {
  endpoint: string;
  status: 'success' | 'error' | 'loading';
  responseTime?: number;
  error?: string;
  data?: any;
}

const RailwayPingTest: React.FC = () => {
  const [pingResults, setPingResults] = useState<PingResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const endpoints = [
    { name: 'Health Check', url: '/healthz' },
    { name: 'Ping Test', url: '/ping' },
    { name: 'API Health', url: '/api/health' },
    { name: 'API Status', url: '/api/status' }
  ];

  const pingEndpoint = async (endpoint: { name: string; url: string }): Promise<PingResult> => {
    const startTime = Date.now();
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${backendUrl}${endpoint.url}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        endpoint: endpoint.name,
        status: 'success',
        responseTime,
        data
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        endpoint: endpoint.name,
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const runPingTest = async () => {
    setIsRunning(true);
    setPingResults([]);

    const results: PingResult[] = [];
    
    for (const endpoint of endpoints) {
      // Add loading state
      setPingResults(prev => [...prev, {
        endpoint: endpoint.name,
        status: 'loading'
      }]);

      const result = await pingEndpoint(endpoint);
      results.push(result);
      
      // Update with result
      setPingResults(prev => prev.map(r => 
        r.endpoint === endpoint.name ? result : r
      ));
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setLastRun(new Date());
    setIsRunning(false);
  };

  const getStatusIcon = (status: PingResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'loading':
        return <Activity className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: PingResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'loading':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Wifi className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Backend Connectivity Test</h3>
            <p className="text-sm text-gray-600">Test Railway backend endpoints</p>
          </div>
        </div>
        
        <button
          onClick={runPingTest}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isRunning ? (
            <>
              <Activity className="w-4 h-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4" />
              Run Test
            </>
          )}
        </button>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {pingResults.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(result.status)}
                <div>
                  <h4 className="font-medium">{result.endpoint}</h4>
                  {result.responseTime !== undefined && (
                    <p className="text-sm opacity-75">
                      Response time: {result.responseTime}ms
                    </p>
                  )}
                  {result.error && (
                    <p className="text-sm opacity-75">
                      Error: {result.error}
                    </p>
                  )}
                </div>
              </div>
              
              {result.data && (
                <div className="text-xs bg-white/50 px-2 py-1 rounded">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {lastRun && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Last test: {lastRun.toLocaleTimeString()}
              </p>
              <p className="text-sm text-gray-600">
                Backend URL: {import.meta.env.VITE_API_URL || 'http://localhost:3000'}
              </p>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {pingResults.filter(r => r.status === 'success').length} / {pingResults.length} endpoints
              </p>
              <p className="text-xs text-gray-600">successful</p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {pingResults.length === 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Ready to Test</h4>
              <p className="text-sm text-blue-800">
                Click "Run Test" to check connectivity with the Railway backend. 
                This will test all available endpoints and show response times.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RailwayPingTest;
