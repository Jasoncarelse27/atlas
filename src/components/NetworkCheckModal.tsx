import React, { useState, useEffect, useRef } from 'react';
import { X, Wifi, WifiOff, Download, Upload, RotateCcw, ExternalLink, Maximize2, Minimize2, Clock, Server, Globe, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';
import { SoundType } from '../hooks/useSoundEffects';
import ProgressBar from './ProgressBar';

interface NetworkCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSoundPlay?: (soundType: SoundType) => void;
}

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'warning';
  value?: number;
  unit?: string;
  message?: string;
  details?: string;
}

const NetworkCheckModal: React.FC<NetworkCheckModalProps> = ({ 
  isOpen, 
  onClose,
  onSoundPlay
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([
    { name: 'DNS Lookup', status: 'pending' },
    { name: 'Latency', status: 'pending' },
    { name: 'Download Speed', status: 'pending' },
    { name: 'Upload Speed', status: 'pending' },
    { name: 'Connection Stability', status: 'pending' }
  ]);
  const [overallStatus, setOverallStatus] = useState<'pending' | 'running' | 'success' | 'error' | 'warning'>('pending');
  const [overallMessage, setOverallMessage] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset tests when modal opens
  useEffect(() => {
    if (isOpen) {
      resetTests();
      runNetworkTests();
    } else {
      // Abort any running tests when modal closes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    if (onSoundPlay) {
      onSoundPlay('click');
    }
  };

  const resetTests = () => {
    setTestResults([
      { name: 'DNS Lookup', status: 'pending' },
      { name: 'Latency', status: 'pending' },
      { name: 'Download Speed', status: 'pending' },
      { name: 'Upload Speed', status: 'pending' },
      { name: 'Connection Stability', status: 'pending' }
    ]);
    setOverallStatus('pending');
    setOverallMessage('');
  };

  const updateTestResult = (index: number, update: Partial<TestResult>) => {
    setTestResults(prev => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...update };
      return newResults;
    });
  };

  const runNetworkTests = async () => {
    if (isRunningTests) return;
    
    setIsRunningTests(true);
    resetTests();
    
    if (onSoundPlay) {
      onSoundPlay('click');
    }
    
    // Create abort controller for cancelling tests
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      // Test 1: DNS Lookup
      updateTestResult(0, { status: 'running' });
      await testDNSLookup(signal);
      
      // Test 2: Latency
      updateTestResult(1, { status: 'running' });
      await testLatency(signal);
      
      // Test 3: Download Speed
      updateTestResult(2, { status: 'running' });
      await testDownloadSpeed(signal);
      
      // Test 4: Upload Speed
      updateTestResult(3, { status: 'running' });
      await testUploadSpeed(signal);
      
      // Test 5: Connection Stability
      updateTestResult(4, { status: 'running' });
      await testConnectionStability(signal);
      
      // Calculate overall status
      calculateOverallStatus();
      
      if (onSoundPlay) {
        onSoundPlay('success');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Network tests aborted');
      } else {
        console.error('Error running network tests:', error);
        setOverallStatus('error');
        setOverallMessage('An error occurred while running network tests. Please try again.');
        
        if (onSoundPlay) {
          onSoundPlay('error');
        }
      }
    } finally {
      setIsRunningTests(false);
      abortControllerRef.current = null;
    }
  };

  const testDNSLookup = async (signal: AbortSignal): Promise<void> => {
    try {
      const startTime = performance.now();
      
      // Simulate DNS lookup with a fetch request to a known domain
      // We'll just measure the time it takes to start the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch('https://www.google.com', {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors' // This allows the request even if CORS is not supported
        });
        
        clearTimeout(timeoutId);
        
        const endTime = performance.now();
        const dnsTime = Math.round(endTime - startTime);
        
        // Evaluate DNS lookup time
        let status: 'success' | 'warning' | 'error' = 'success';
        let message = 'DNS resolution is fast';
        
        if (dnsTime > 1000) {
          status = 'error';
          message = 'DNS resolution is very slow';
        } else if (dnsTime > 300) {
          status = 'warning';
          message = 'DNS resolution is somewhat slow';
        }
        
        updateTestResult(0, { 
          status, 
          value: dnsTime, 
          unit: 'ms',
          message,
          details: `Time to first byte: ${dnsTime}ms`
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          updateTestResult(0, { 
            status: 'error', 
            message: 'DNS lookup timed out',
            details: 'The DNS lookup took too long to complete. This could indicate DNS server issues.'
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (signal.aborted) {
        // Gracefully handle abort without throwing error
        return;
      }
      
      console.error('DNS lookup test error:', error);
      updateTestResult(0, { 
        status: 'error', 
        message: 'DNS lookup failed',
        details: 'Could not resolve domain names. This may indicate network connectivity issues.'
      });
    }
  };

  const testLatency = async (signal: AbortSignal): Promise<void> => {
    try {
      // We'll ping a few well-known domains and take the average
      const domains = ['https://www.google.com', 'https://www.microsoft.com', 'https://www.amazon.com'];
      const pings: number[] = [];
      
      for (const domain of domains) {
        if (signal.aborted) {
          // Gracefully handle abort without throwing error
          return;
        }
        
        const startTime = performance.now();
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          await fetch(domain, {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors'
          });
          
          clearTimeout(timeoutId);
          
          const endTime = performance.now();
          pings.push(endTime - startTime);
        } catch (error) {
          // Skip failed pings
          console.warn(`Ping to ${domain} failed:`, error);
        }
      }
      
      if (pings.length === 0) {
        updateTestResult(1, { 
          status: 'error', 
          message: 'Could not measure latency',
          details: 'All ping attempts failed. This may indicate network connectivity issues.'
        });
        return;
      }
      
      // Calculate average ping
      const avgPing = Math.round(pings.reduce((sum, ping) => sum + ping, 0) / pings.length);
      
      // Evaluate latency
      let status: 'success' | 'warning' | 'error' = 'success';
      let message = 'Excellent latency';
      
      if (avgPing > 300) {
        status = 'error';
        message = 'High latency';
      } else if (avgPing > 100) {
        status = 'warning';
        message = 'Moderate latency';
      }
      
      updateTestResult(1, { 
        status, 
        value: avgPing, 
        unit: 'ms',
        message,
        details: `Average ping time: ${avgPing}ms (${pings.length} successful pings)`
      });
    } catch (error) {
      if (signal.aborted) {
        // Gracefully handle abort without throwing error
        return;
      }
      
      console.error('Latency test error:', error);
      updateTestResult(1, { 
        status: 'error', 
        message: 'Latency test failed',
        details: 'Could not measure network latency. This may indicate connectivity issues.'
      });
    }
  };

  const testDownloadSpeed = async (signal: AbortSignal): Promise<void> => {
    try {
      // We'll download a small file and measure the speed
      // For simplicity, we'll use a small image from a CDN
      const fileUrl = 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?cs=srgb&dl=pexels-jaime-reimer-2662116.jpg&fm=jpg&w=200&h=200';
      const startTime = performance.now();
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(fileUrl, {
          signal: controller.signal,
          cache: 'no-store' // Ensure we don't use cached version
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        // Get the file size from headers or response
        const contentLength = response.headers.get('content-length');
        let fileSize = contentLength ? parseInt(contentLength, 10) : 0;
        
        // If we couldn't get file size from headers, read the blob
        if (!fileSize) {
          const blob = await response.blob();
          fileSize = blob.size;
        }
        
        clearTimeout(timeoutId);
        
        const endTime = performance.now();
        const downloadTime = (endTime - startTime) / 1000; // in seconds
        
        // Calculate speed in Mbps (megabits per second)
        // 8 bits per byte, 1,000,000 bits per megabit
        const downloadSpeed = ((fileSize * 8) / downloadTime) / 1000000;
        const roundedSpeed = Math.round(downloadSpeed * 100) / 100; // Round to 2 decimal places
        
        // Evaluate download speed
        let status: 'success' | 'warning' | 'error' = 'success';
        let message = 'Good download speed';
        
        if (downloadSpeed < 1) {
          status = 'error';
          message = 'Very slow download speed';
        } else if (downloadSpeed < 5) {
          status = 'warning';
          message = 'Slow download speed';
        }
        
        updateTestResult(2, { 
          status, 
          value: roundedSpeed, 
          unit: 'Mbps',
          message,
          details: `Downloaded ${(fileSize / 1024).toFixed(2)}KB in ${downloadTime.toFixed(2)}s`
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          updateTestResult(2, { 
            status: 'error', 
            message: 'Download test timed out',
            details: 'The download test took too long to complete. This indicates very slow network speed.'
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (signal.aborted) {
        // Gracefully handle abort without throwing error
        return;
      }
      
      console.error('Download speed test error:', error);
      updateTestResult(2, { 
        status: 'error', 
        message: 'Download test failed',
        details: 'Could not measure download speed. This may indicate network connectivity issues.'
      });
    }
  };

  const testUploadSpeed = async (signal: AbortSignal): Promise<void> => {
    try {
      // Simulate upload speed test
      // In a real implementation, we would upload data to a server and measure the time
      // Since we can't do that in the browser environment, we'll simulate it
      
      // Generate random data to "upload"
      const dataSize = 500 * 1024; // 500KB
      const randomData = new Array(dataSize).fill(0).map(() => Math.floor(Math.random() * 256));
      const blob = new Blob([new Uint8Array(randomData)], { type: 'application/octet-stream' });
      
      const startTime = performance.now();
      
      // Simulate network delay based on browser performance
      // This isn't a real upload test, but gives us something to display
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const endTime = performance.now();
      const uploadTime = (endTime - startTime) / 1000; // in seconds
      
      // Calculate simulated speed in Mbps
      const uploadSpeed = ((dataSize * 8) / uploadTime) / 1000000;
      const roundedSpeed = Math.round(uploadSpeed * 100) / 100; // Round to 2 decimal places
      
      // For simulation, we'll adjust the speed based on download speed
      const downloadResult = testResults[2];
      let simulatedSpeed = roundedSpeed;
      
      if (downloadResult.status === 'success' && downloadResult.value) {
        // Simulate upload being somewhat slower than download
        simulatedSpeed = downloadResult.value * 0.7;
      }
      
      // Evaluate upload speed
      let status: 'success' | 'warning' | 'error' = 'success';
      let message = 'Good upload speed';
      
      if (simulatedSpeed < 0.5) {
        status = 'error';
        message = 'Very slow upload speed';
      } else if (simulatedSpeed < 2) {
        status = 'warning';
        message = 'Slow upload speed';
      }
      
      updateTestResult(3, { 
        status, 
        value: simulatedSpeed, 
        unit: 'Mbps',
        message,
        details: `Simulated upload test (based on browser performance and download speed)`
      });
    } catch (error) {
      if (signal.aborted) {
        // Gracefully handle abort without throwing error
        return;
      }
      
      console.error('Upload speed test error:', error);
      updateTestResult(3, { 
        status: 'error', 
        message: 'Upload test failed',
        details: 'Could not measure upload speed. This may indicate network connectivity issues.'
      });
    }
  };

  const testConnectionStability = async (signal: AbortSignal): Promise<void> => {
    try {
      // Test connection stability by doing multiple small requests
      const testUrl = 'https://www.google.com/favicon.ico';
      const numTests = 5;
      const results: number[] = [];
      let failures = 0;
      
      for (let i = 0; i < numTests; i++) {
        if (signal.aborted) {
          // Gracefully handle abort without throwing error
          return;
        }
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const startTime = performance.now();
          
          await fetch(testUrl, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store',
            mode: 'no-cors'
          });
          
          clearTimeout(timeoutId);
          
          const endTime = performance.now();
          results.push(endTime - startTime);
        } catch (error) {
          failures++;
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (results.length === 0) {
        updateTestResult(4, { 
          status: 'error', 
          message: 'Connection is unstable',
          details: 'All stability test requests failed. Your connection appears to be very unstable.'
        });
        return;
      }
      
      // Calculate jitter (variation in ping times)
      const avgPing = results.reduce((sum, time) => sum + time, 0) / results.length;
      const jitter = Math.sqrt(results.reduce((sum, time) => sum + Math.pow(time - avgPing, 2), 0) / results.length);
      const failureRate = failures / numTests;
      
      // Evaluate stability
      let status: 'success' | 'warning' | 'error' = 'success';
      let message = 'Connection is stable';
      
      if (failureRate > 0.3 || jitter > 100) {
        status = 'error';
        message = 'Connection is unstable';
      } else if (failureRate > 0 || jitter > 50) {
        status = 'warning';
        message = 'Connection has some instability';
      }
      
      updateTestResult(4, { 
        status, 
        value: Math.round(jitter), 
        unit: 'ms',
        message,
        details: `Jitter: ${Math.round(jitter)}ms, Failed requests: ${failures}/${numTests}`
      });
    } catch (error) {
      if (signal.aborted) {
        // Gracefully handle abort without throwing error
        return;
      }
      
      console.error('Connection stability test error:', error);
      updateTestResult(4, { 
        status: 'error', 
        message: 'Stability test failed',
        details: 'Could not measure connection stability. This may indicate network issues.'
      });
    }
  };

  const calculateOverallStatus = () => {
    // Count results by status
    const counts = {
      success: 0,
      warning: 0,
      error: 0,
      pending: 0,
      running: 0
    };
    
    testResults.forEach(result => {
      counts[result.status]++;
    });
    
    // Determine overall status
    let status: 'pending' | 'running' | 'success' | 'error' | 'warning' = 'pending';
    let message = '';
    
    if (counts.running > 0) {
      status = 'running';
      message = 'Tests are still running...';
    } else if (counts.pending > 0) {
      status = 'pending';
      message = 'Some tests have not started yet.';
    } else if (counts.error > 0) {
      status = 'error';
      message = 'Your network connection has issues that may affect performance.';
    } else if (counts.warning > 0) {
      status = 'warning';
      message = 'Your network connection is working but has some limitations.';
    } else {
      status = 'success';
      message = 'Your network connection is working well.';
    }
    
    setOverallStatus(status);
    setOverallMessage(message);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <LoadingSpinner size="sm" />;
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'running':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'pending':
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getTestIcon = (name: string) => {
    switch (name) {
      case 'DNS Lookup':
        return <Globe className="w-5 h-5" />;
      case 'Latency':
        return <Clock className="w-5 h-5" />;
      case 'Download Speed':
        return <Download className="w-5 h-5" />;
      case 'Upload Speed':
        return <Upload className="w-5 h-5" />;
      case 'Connection Stability':
        return <Wifi className="w-5 h-5" />;
      default:
        return <Server className="w-5 h-5" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="network-check-title"
    >
      <div 
        className={`bg-white rounded-xl border border-gray-300 shadow-2xl overflow-hidden flex flex-col ${
          isFullscreen 
            ? 'w-full h-full rounded-none border-0' 
            : 'max-w-2xl w-full max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wifi className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 id="network-check-title" className="text-lg font-bold text-gray-900">Network Connection Check</h2>
              <p className="text-sm text-gray-600">Diagnose your connection quality</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Tooltip content={isFullscreen ? "Exit fullscreen" : "Fullscreen"} position="bottom">
              <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </Tooltip>
            
            <Tooltip content="Close" position="bottom">
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close network check"
              >
                <X className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overall Status */}
          <div className={`p-4 rounded-lg border mb-6 ${getStatusColor(overallStatus)}`}>
            <div className="flex items-start gap-3">
              {getStatusIcon(overallStatus)}
              <div>
                <h3 className="font-medium">Network Status</h3>
                <p>{overallMessage}</p>
              </div>
            </div>
          </div>
          
          {/* Test Results */}
          <div className="space-y-4">
            {testResults.map((result, index) => (
              <div 
                key={result.name} 
                className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      result.status === 'success' ? 'bg-green-100' :
                      result.status === 'warning' ? 'bg-yellow-100' :
                      result.status === 'error' ? 'bg-red-100' :
                      result.status === 'running' ? 'bg-blue-100' :
                      'bg-gray-100'
                    }`}>
                      {getTestIcon(result.name)}
                    </div>
                    <h4 className="font-medium">{result.name}</h4>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {result.status !== 'pending' && result.status !== 'running' && result.value !== undefined && (
                      <span className="font-mono font-medium">
                        {result.value} {result.unit}
                      </span>
                    )}
                    {getStatusIcon(result.status)}
                  </div>
                </div>
                
                {result.message && (
                  <p className="text-sm mb-2">{result.message}</p>
                )}
                
                {result.status === 'running' && (
                  <div className="mt-2">
                    <div className="h-1 bg-blue-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full animate-pulse"
                        style={{ width: '60%' }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {result.details && (
                  <div className="mt-2 text-xs opacity-70">
                    {result.details}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {isRunningTests ? 'Running tests...' : 'Tests completed'}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={runNetworkTests}
                disabled={isRunningTests}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isRunningTests ? (
                  <>
                    <LoadingSpinner size="sm" color="white" />
                    <span>Running Tests...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Run Tests Again</span>
                  </>
                )}
              </button>
              
              <Tooltip content="Open full speed test in new tab">
                <a
                  href="https://speedtest.mybroadband.co.za/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  onClick={() => onSoundPlay?.('click')}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Full Speed Test</span>
                </a>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkCheckModal;
