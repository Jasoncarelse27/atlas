import { Activity, AlertTriangle, Database, HardDrive, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface CostMetrics {
  storageUsage: number;
  databaseSize: number;
  rowCounts: {
    conversations: number;
    messages: number;
    user_profiles: number;
  };
  expensiveQueries: Array<{
    query: string;
    calls: number;
    total_time: number;
    mean_time: number;
  }>;
}

const CostMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<CostMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch storage usage
      const { data: storageData } = await supabase
        .from('storage_usage')
        .select('*');

      // Fetch row counts
      const { data: rowCounts } = await supabase
        .from('table_row_counts')
        .select('*');

      // Fetch expensive queries
      const { data: expensiveQueries } = await supabase
        .from('expensive_queries')
        .select('*')
        .limit(5);

      const rowCountsMap = rowCounts?.reduce((acc: any, row: any) => {
        acc[row.table_name] = row.row_count;
        return acc;
      }, {}) || {};

      setMetrics({
        storageUsage: storageData?.[0]?.size_bytes || 0,
        databaseSize: storageData?.reduce((sum: number, table: any) => sum + (table.size_bytes || 0), 0) || 0,
        rowCounts: {
          conversations: rowCountsMap.conversations || 0,
          messages: rowCountsMap.messages || 0,
          user_profiles: rowCountsMap.user_profiles || 0,
        },
        expensiveQueries: expensiveQueries || []
      });

    } catch (err) {
      setError('Failed to load cost metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageWarning = (size: number) => {
    const mb = size / (1024 * 1024);
    if (mb > 1000) return 'High storage usage - consider cleanup';
    if (mb > 500) return 'Moderate storage usage';
    return 'Normal storage usage';
  };

  const getRowCountWarning = (count: number, table: string) => {
    if (table === 'messages' && count > 10000) return 'High message count - consider archiving';
    if (table === 'conversations' && count > 1000) return 'High conversation count';
    return 'Normal';
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
        <div className="flex items-center text-red-600 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Cost Monitor
        </h3>
        <button
          onClick={fetchMetrics}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Storage Usage */}
      <div className="mb-6">
        <div className="flex items-center mb-3">
          <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
          <h4 className="font-medium text-gray-900 dark:text-white">Storage Usage</h4>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Total Database Size</span>
            <span className="font-mono text-sm">{formatBytes(metrics.databaseSize)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((metrics.databaseSize / (1024 * 1024 * 100)) * 100, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {getStorageWarning(metrics.databaseSize)}
          </p>
        </div>
      </div>

      {/* Row Counts */}
      <div className="mb-6">
        <div className="flex items-center mb-3">
          <Database className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
          <h4 className="font-medium text-gray-900 dark:text-white">Table Row Counts</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(metrics.rowCounts).map(([table, count]) => (
            <div key={table} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {table.replace('_', ' ')}
                </span>
                <span className="font-mono text-sm">{count.toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {getRowCountWarning(count, table)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Expensive Queries */}
      {metrics.expensiveQueries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-2" />
            <h4 className="font-medium text-gray-900 dark:text-white">Slow Queries</h4>
          </div>
          <div className="space-y-3">
            {metrics.expensiveQueries.map((query, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Query {index + 1}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {query.mean_time.toFixed(2)}ms avg
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                  {query.query.substring(0, 100)}...
                </p>
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{query.calls} calls</span>
                  <span>{query.total_time.toFixed(2)}ms total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Optimization Tips */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center mb-3">
          <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h4 className="font-medium text-gray-900 dark:text-white">Optimization Tips</h4>
        </div>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>• Run the optimization SQL script to add indexes</li>
          <li>• Consider archiving old conversations</li>
          <li>• Monitor expensive queries and optimize them</li>
          <li>• Use pagination for large result sets</li>
        </ul>
      </div>
    </div>
  );
};

export default CostMonitor;
