/**
 * Cache Monitoring Dashboard for Atlas
 * Real-time monitoring of Redis cache performance and health
 */

import React, { useEffect, useState } from 'react';
import { cachedDatabaseService } from '../services/cachedDatabaseService';
import { redisCacheService } from '../services/redisCacheService';

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalQueries: number;
}

interface HealthStatus {
  redis: boolean;
  supabase: boolean;
}

const CacheMonitoringDashboard: React.FC = () => {
  const [stats, setStats] = useState<CacheStats>({
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    totalQueries: 0
  });
  
  const [health, setHealth] = useState<HealthStatus>({
    redis: false,
    supabase: false
  });
  
  const [isVisible, setIsVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!isVisible) return;

    const updateStats = async () => {
      const currentStats = redisCacheService.getStats();
      setStats(currentStats);

      const healthStatus = await cachedDatabaseService.healthCheck();
      setHealth(healthStatus);
    };

    updateStats();

    if (autoRefresh) {
      const interval = setInterval(updateStats, 2000); // Update every 2 seconds
      return () => clearInterval(interval);
    }
  }, [isVisible, autoRefresh]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getHitRateColor = (rate: number): string => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthColor = (isHealthy: boolean): string => {
    return isHealthy ? 'text-green-600' : 'text-red-600';
  };

  const getHealthIcon = (isHealthy: boolean): string => {
    return isHealthy ? '✅' : '❌';
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors z-50"
      >
        📊 Cache Monitor
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Cache Performance</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2 py-1 text-xs rounded ${
              autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Health Status */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">System Health</h4>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm">Redis Cache</span>
            <span className={`text-sm font-medium ${getHealthColor(health.redis)}`}>
              {getHealthIcon(health.redis)} {health.redis ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Database</span>
            <span className={`text-sm font-medium ${getHealthColor(health.supabase)}`}>
              {getHealthIcon(health.supabase)} {health.supabase ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(stats.hits)}
            </div>
            <div className="text-xs text-blue-700">Cache Hits</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(stats.misses)}
            </div>
            <div className="text-xs text-red-700">Cache Misses</div>
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-green-700">Hit Rate</span>
            <span className={`text-lg font-bold ${getHitRateColor(stats.hitRate)}`}>
              {stats.hitRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(stats.hitRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-purple-600">
              {formatNumber(stats.sets)}
            </div>
            <div className="text-xs text-purple-700">Cache Sets</div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg">
            <div className="text-lg font-bold text-orange-600">
              {formatNumber(stats.deletes)}
            </div>
            <div className="text-xs text-orange-700">Cache Deletes</div>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Total Queries:</span>
              <span className="font-medium">{formatNumber(stats.totalQueries)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
        <h4 className="text-sm font-medium text-yellow-800 mb-2">Performance Insights</h4>
        <div className="text-xs text-yellow-700 space-y-1">
          {stats.hitRate >= 80 && (
            <div>🚀 Excellent cache performance! Database load reduced by ~80%</div>
          )}
          {stats.hitRate >= 60 && stats.hitRate < 80 && (
            <div>✅ Good cache performance. Consider increasing TTL for better hit rates</div>
          )}
          {stats.hitRate < 60 && (
            <div>⚠️ Low cache hit rate. Check cache configuration and TTL settings</div>
          )}
          {stats.totalQueries === 0 && (
            <div>📊 No queries yet. Start using the app to see cache performance</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            redisCacheService.resetStats();
            setStats(redisCacheService.getStats());
          }}
          className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 transition-colors"
        >
          Reset Stats
        </button>
        <button
          onClick={async () => {
            const healthStatus = await cachedDatabaseService.healthCheck();
            setHealth(healthStatus);
          }}
          className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded text-sm hover:bg-blue-200 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default CacheMonitoringDashboard;