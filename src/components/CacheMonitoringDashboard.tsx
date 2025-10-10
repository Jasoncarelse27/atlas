// Cache Monitoring Dashboard
// Real-time monitoring of enhanced response caching performance

import React, { useEffect, useState } from 'react';
import { cacheManagementService } from '../services/cacheManagementService';
import type { Tier } from '../types/tier';

interface CacheMetrics {
  hitRate: number;
  costSavings: number;
  totalQueries: number;
  cachedQueries: number;
  apiCallsSaved: number;
  estimatedMonthlySavings: number;
}

interface TierBreakdown {
  entries: number;
  hits: number;
  hitRate: number;
}

export const CacheMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null);
  const [tierBreakdown, setTierBreakdown] = useState<Record<Tier, TierBreakdown>>({} as Record<Tier, TierBreakdown>);
  const [topQueries, setTopQueries] = useState<Array<{ query: string; hits: number; savings: number }>>([]);
  const [health, setHealth] = useState<{ status: string; issues: string[]; recommendations: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, tierData, topQueriesData, healthData] = await Promise.all([
        cacheManagementService.getPerformanceMetrics(),
        cacheManagementService.getTierBreakdown(),
        cacheManagementService.getTopQueries(10),
        cacheManagementService.getCacheHealth()
      ]);

      setMetrics(metricsData);
      setTierBreakdown(tierData);
      setTopQueries(topQueriesData);
      setHealth(healthData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cache metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeCache = async () => {
    try {
      const result = await cacheManagementService.optimizeCache();
      alert(`Cache optimization complete!\nExpired entries removed: ${result.expiredRemoved}\nDuplicates removed: ${result.duplicatesRemoved}`);
      loadMetrics(); // Refresh metrics
    } catch (err) {
      alert('Failed to optimize cache: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handlePrePopulateCache = async () => {
    try {
      await cacheManagementService.prePopulateHighValueCache();
      alert('High-value cache pre-population complete!');
      loadMetrics(); // Refresh metrics
    } catch (err) {
      alert('Failed to pre-populate cache: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    loadMetrics();
    
    // Refresh metrics every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-lg">
        <h3 className="text-red-400 font-semibold mb-2">Cache Monitoring Error</h3>
        <p className="text-red-300 text-sm">{error}</p>
        <button 
          onClick={loadMetrics}
          className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="p-6 bg-gray-900 rounded-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Enhanced Response Cache Dashboard</h2>
        <div className="flex gap-2">
          <button 
            onClick={handleOptimizeCache}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Optimize Cache
          </button>
          <button 
            onClick={handlePrePopulateCache}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
          >
            Pre-populate
          </button>
          <button 
            onClick={loadMetrics}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <div className="p-4 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-300">Cache Health:</span>
            <span className={`text-sm font-semibold ${getStatusColor(health.status)}`}>
              {health.status.toUpperCase()}
            </span>
          </div>
          {health.issues.length > 0 && (
            <div className="mb-2">
              <span className="text-sm text-red-400">Issues:</span>
              <ul className="text-sm text-red-300 ml-4 list-disc">
                {health.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {health.recommendations.length > 0 && (
            <div>
              <span className="text-sm text-blue-400">Recommendations:</span>
              <ul className="text-sm text-blue-300 ml-4 list-disc">
                {health.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{(metrics.hitRate * 100).toFixed(1)}%</div>
            <div className="text-sm text-gray-400">Hit Rate</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">${metrics.costSavings.toFixed(2)}</div>
            <div className="text-sm text-gray-400">Cost Savings</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-purple-400">{metrics.apiCallsSaved}</div>
            <div className="text-sm text-gray-400">API Calls Saved</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">${metrics.estimatedMonthlySavings.toFixed(2)}</div>
            <div className="text-sm text-gray-400">Est. Monthly Savings</div>
          </div>
        </div>
      )}

      {/* Tier Breakdown */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Performance by Tier</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(tierBreakdown).map(([tier, data]) => (
            <div key={tier} className="p-3 bg-gray-700 rounded">
              <div className="text-sm font-medium text-gray-300 capitalize">{tier} Tier</div>
              <div className="text-lg font-bold text-white">{data.entries} entries</div>
              <div className="text-sm text-gray-400">{data.hits} hits</div>
              <div className="text-sm text-green-400">{(data.hitRate * 100).toFixed(1)}% hit rate</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Queries */}
      {topQueries.length > 0 && (
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing Cached Queries</h3>
          <div className="space-y-2">
            {topQueries.map((query, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                <div className="text-sm text-gray-300 truncate flex-1 mr-4">{query.query}</div>
                <div className="flex gap-4 text-sm">
                  <span className="text-blue-400">{query.hits} hits</span>
                  <span className="text-green-400">${query.savings.toFixed(2)} saved</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart Placeholder */}
      <div className="p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Performance Trends</h3>
        <div className="h-32 bg-gray-700 rounded flex items-center justify-center">
          <span className="text-gray-400">Performance chart would go here</span>
        </div>
      </div>
    </div>
  );
};
