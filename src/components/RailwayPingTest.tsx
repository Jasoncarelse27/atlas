import React, { useEffect, useState } from 'react';

interface PingResponse {
  status: string;
  message: string;
  timestamp: string;
  uptime: number;
}

interface RailwayPingTestProps {
  railwayUrl?: string;
  onTestComplete?: (success: boolean, data?: PingResponse, error?: string) => void;
}

const RailwayPingTest: React.FC<RailwayPingTestProps> = ({ 
  railwayUrl = 'https://atlas-production-14090287.up.railway.app',
  onTestComplete 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: PingResponse;
    error?: string;
    timestamp: string;
  } | null>(null);

  const testRailwayPing = async () => {
    setIsLoading(true);
    const testTimestamp = new Date().toISOString();
    
    try {
      console.log('🚀 Testing Railway backend /ping endpoint...');
      console.log(`📍 URL: ${railwayUrl}/ping`);
      console.log('⏳ Sending fetch request...');

      const response = await fetch(`${railwayUrl}/ping`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Atlas-Frontend-Test/1.0'
        },
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
      console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PingResponse = await response.json();
      
      console.log('✅ Railway Ping Response:');
      console.log(JSON.stringify(data, null, 2));

      const result = {
        success: true,
        data,
        timestamp: testTimestamp
      };

      setTestResult(result);
      onTestComplete?.(true, data);
      
      console.log('🎉 SUCCESS: Railway backend /ping endpoint is working!');
      console.log(`📊 Backend uptime: ${data.uptime.toFixed(2)} seconds`);
      console.log(`🕐 Response timestamp: ${data.timestamp}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      console.error('❌ FAILED: Railway backend ping test failed');
      console.error('Error details:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('⏰ Timeout: Request took longer than 10 seconds');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network Error: Unable to reach Railway backend');
        console.error('💡 Check if the Railway URL is correct and the service is deployed');
      }

      const result = {
        success: false,
        error: errorMessage,
        timestamp: testTimestamp
      };

      setTestResult(result);
      onTestComplete?.(false, undefined, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-test on component mount
    testRailwayPing();
  }, []);

  return (
    <div className="railway-ping-test" style={{
      padding: '16px',
      margin: '16px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9',
      fontFamily: 'monospace',
      fontSize: '14px'
    }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#333' }}>
        🚀 Railway Backend Ping Test
      </h3>
      
      <div style={{ marginBottom: '12px' }}>
        <strong>URL:</strong> {railwayUrl}/ping
      </div>

      {isLoading && (
        <div style={{ color: '#007bff' }}>
          ⏳ Testing Railway backend...
        </div>
      )}

      {testResult && (
        <div style={{ 
          marginTop: '12px',
          padding: '12px',
          borderRadius: '4px',
          backgroundColor: testResult.success ? '#d4edda' : '#f8d7da',
          border: `1px solid ${testResult.success ? '#c3e6cb' : '#f5c6cb'}`,
          color: testResult.success ? '#155724' : '#721c24'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            {testResult.success ? '✅ SUCCESS' : '❌ FAILED'}
          </div>
          
          {testResult.success && testResult.data && (
            <div>
              <div><strong>Status:</strong> {testResult.data.status}</div>
              <div><strong>Message:</strong> {testResult.data.message}</div>
              <div><strong>Uptime:</strong> {testResult.data.uptime.toFixed(2)}s</div>
              <div><strong>Timestamp:</strong> {new Date(testResult.data.timestamp).toLocaleString()}</div>
            </div>
          )}
          
          {!testResult.success && testResult.error && (
            <div>
              <div><strong>Error:</strong> {testResult.error}</div>
            </div>
          )}
          
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            Test completed at: {new Date(testResult.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      <button 
        onClick={testRailwayPing}
        disabled={isLoading}
        style={{
          marginTop: '12px',
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1
        }}
      >
        {isLoading ? 'Testing...' : '🔄 Retest'}
      </button>
    </div>
  );
};

export default RailwayPingTest;
