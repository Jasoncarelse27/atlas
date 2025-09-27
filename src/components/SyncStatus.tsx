import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { syncService } from '../services/syncService';
import { resendService } from '../services/resendService';

interface SyncStatusProps {
  className?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null as string | null,
    pendingCount: 0,
    failedCount: 0,
  });
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const updateStatus = async () => {
      try {
        const syncStatus = await syncService.getSyncStatus();
        const resendStatus = await resendService.getResendStatus();
        
        setStatus({
          isOnline: syncStatus.isOnline,
          isSyncing: syncStatus.isSyncing,
          lastSyncTime: syncStatus.lastSyncTime,
          pendingCount: syncStatus.pendingCount,
          failedCount: resendStatus.failedCount,
        });
      } catch (error) {
        console.error('[SyncStatus] Failed to get status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      await resendService.resendFailedMessages();
    } catch (error) {
      console.error('[SyncStatus] Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleForceSync = async () => {
    try {
      await syncService.forceSyncAll();
    } catch (error) {
      console.error('[SyncStatus] Force sync failed:', error);
    }
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  if (!status.isOnline) {
    return (
      <div className={`flex items-center gap-2 text-orange-500 ${className}`}>
        <WifiOff className="w-4 h-4" />
        <span className="text-sm">Offline</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center gap-1">
        <Wifi className="w-4 h-4 text-green-500" />
        <span className="text-sm text-gray-600">Online</span>
      </div>

      {/* Sync Status */}
      {status.isSyncing ? (
        <div className="flex items-center gap-1">
          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-sm text-blue-600">Syncing...</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-gray-600">Synced</span>
        </div>
      )}

      {/* Pending Messages */}
      {status.pendingCount > 0 && (
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-yellow-600">{status.pendingCount} pending</span>
        </div>
      )}

      {/* Failed Messages */}
      {status.failedCount > 0 && (
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-600">{status.failedCount} failed</span>
          <button
            onClick={handleRetryFailed}
            disabled={isRetrying}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}

      {/* Last Sync Time */}
      {status.lastSyncTime && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">
            Last sync: {formatLastSync(status.lastSyncTime)}
          </span>
        </div>
      )}

      {/* Force Sync Button */}
      <button
        onClick={handleForceSync}
        disabled={status.isSyncing}
        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
      >
        {status.isSyncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

export default SyncStatus;
