import { Globe, Monitor, Palette, Zap } from 'lucide-react';
import React from 'react';
import ProgressBar from '../ProgressBar';

interface PerformanceMetricsData {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  domNodes: number;
  eventListeners: number;
  cssRules: number;
}

interface PerformanceMetricsProps {
  metrics: PerformanceMetricsData | null;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
        <div className="flex items-center space-x-2 mb-3">
          <Monitor className="w-5 h-5 text-blue-400" />
          <h3 className="font-medium text-gray-200">Performance Metrics</h3>
        </div>
        <p className="text-gray-400 text-sm">Loading metrics...</p>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPerformanceScore = () => {
    let score = 100;
    
    // Deduct points for poor performance
    if (metrics.loadTime > 1000) score -= 20;
    if (metrics.renderTime > 100) score -= 15;
    if (metrics.domNodes > 1000) score -= 15;
    if (metrics.memoryUsage > 50 * 1024 * 1024) score -= 20; // 50MB
    if (metrics.cssRules > 500) score -= 10;
    
    return Math.max(0, score);
  };

  const score = getPerformanceScore();

  return (
    <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Monitor className="w-5 h-5 text-blue-400" />
          <h3 className="font-medium text-gray-200">Performance Metrics</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400">{score}</div>
          <div className="text-xs text-gray-400">Overall Score</div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Load Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-gray-300">Load Time</span>
          </div>
          <span className="text-sm text-gray-200">{metrics.loadTime.toFixed(1)}ms</span>
        </div>
        <ProgressBar 
          progress={Math.max(0, 1000 - metrics.loadTime) / 10} 
          className="h-1"
        />

        {/* Render Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">Render Time</span>
          </div>
          <span className="text-sm text-gray-200">{metrics.renderTime.toFixed(1)}ms</span>
        </div>
        <ProgressBar 
          progress={Math.max(0, 100 - metrics.renderTime)} 
          className="h-1"
        />

        {/* Memory Usage */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Memory Usage</span>
          </div>
          <span className="text-sm text-gray-200">{formatBytes(metrics.memoryUsage)}</span>
        </div>

        {/* DOM Nodes */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Palette className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-300">DOM Nodes</span>
          </div>
          <span className="text-sm text-gray-200">{metrics.domNodes.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
          <div>
            <span className="block">CSS Rules:</span>
            <span className="text-gray-200">{metrics.cssRules}</span>
          </div>
          <div>
            <span className="block">Event Listeners:</span>
            <span className="text-gray-200">{metrics.eventListeners}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;
