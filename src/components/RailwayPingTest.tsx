import React, { useEffect, useState } from 'react';

interface PingResponse {
  status: string;
  message: string;
  timestamp: string;
  uptime: number;
}

interface RailwayPingTestProps {
  railwayUrl?: string;
  endpoint?: string;
  timeout?: number;
  retries?: number;
  onTestComplete?: (success: boolean, data?: PingResponse, error?: string) => void;
  autoTest?: boolean;
}

const RailwayPingTest: React.FC<RailwayPingTestProps> = ({ 
  railwayUrl = 'https://atlas-production-14090287.up.railway.app',
  endpoint = '/ping',
  timeout = 10000,
  retries = 3,
  onTestComplete,
  autoTest = true
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: PingResponse;
    error?: string;
    timestamp: string;
    attempts: number;
  } | null>(null);

  const testEndpoint = async (attempt: number = 1): Promise<{ success: boolean; data?: PingResponse; error?: string }> => {
    const testUrl = `${railwayUrl}${endpoint}`;
    
    try {
      console.log(`🏓 Testing backend endpoint (attempt ${attempt}/${retries})...`);
      console.log(`📍 URL: ${testUrl}`);
      console.log('⏳ Sending fetch request...');

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Atlas-Frontend-Test/1.0'
        },
        signal: AbortSignal.timeout(timeout)
      });

      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
      console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PingResponse = await response.json();
      
      console.log('✅ Backend Response:');
      console.log(JSON.stringify(data, null, 2));

      return { success: true, data };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      console.error(`❌ Attempt ${attempt} failed:`, error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('⏰ Timeout: Request took longer than expected');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('🌐 Network Error: Unable to reach backend');
      }

      return { success: false, error: errorMessage };
    }
  };

  const testWithRetries = async () => {
    setIsLoading(true);
    const testTimestamp = new Date().toISOString();
    let lastError = '';
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      const result = await testEndpoint(attempt);
      
      if (result.success && result.data) {
        const finalResult = {
          success: true,
          data: result.data,
          timestamp: testTimestamp,
          attempts: attempt
        };

        setTestResult(finalResult);
        onTestComplete?.(true, result.data);
        
        console.log('🎉 SUCCESS: Backend endpoint is working!');
        console.log(`📊 Backend uptime: ${result.data.uptime.toFixed(2)} seconds`);
        console.log(`🕐 Response timestamp: ${result.data.timestamp}`);
        console.log(`🔄 Attempts needed: ${attempt}`);
        
        return;
      } else {
        lastError = result.error || 'Unknown error';
        console.log(`⚠️ Attempt ${attempt} failed, ${attempt < retries ? 'retrying...' : 'giving up'}`);
        
        if (attempt < retries) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    const finalResult = {
      success: false,
      error: lastError,
      timestamp: testTimestamp,
      attempts: retries
    };

    setTestResult(finalResult);
    onTestComplete?.(false, undefined, lastError);
    
    console.log('❌ FAILED: All attempts to reach backend failed');
  };

  useEffect(() => {
    if (autoTest) {
      testWithRetries();
    }
  }, [railwayUrl, endpoint, timeout, retries, autoTest]);

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
        🚀 Backend Health Test
      </h3>
      
      <div style={{ marginBottom: '12px' }}>
        <strong>URL:</strong> {railwayUrl}{endpoint}
      </div>

      <div style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
        <strong>Config:</strong> Timeout: {timeout}ms, Retries: {retries}, Auto-test: {autoTest ? 'Yes' : 'No'}
      </div>

      {isLoading && (
        <div style={{ color: '#007bff' }}>
          ⏳ Testing backend endpoint...
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
              <div><strong>Attempts:</strong> {testResult.attempts}</div>
            </div>
          )}
          
          {!testResult.success && testResult.error && (
            <div>
              <div><strong>Error:</strong> {testResult.error}</div>
              <div><strong>Attempts:</strong> {testResult.attempts}</div>
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
        onClick={testWithRetries}
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
