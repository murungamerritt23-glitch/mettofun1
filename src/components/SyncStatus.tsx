'use client';

import { useState, useEffect } from 'react';
import { useSyncStore } from '@/store';
import { useUIStore } from '@/store';
import { RefreshCw, Wifi, WifiOff, AlertCircle, Check, Trash2, Clock } from 'lucide-react';
import { getSyncStatus, triggerSync, forceSyncNow } from '@/lib/sync-service';

interface SyncStatusProps {
  onManualSync?: () => void;
}

export function SyncStatus({ onManualSync }: SyncStatusProps) {
  const { queue, isSyncing, lastSyncTime, removeFromQueue, clearQueue, getPendingCount } = useSyncStore();
  const { isOnline, setOnline } = useUIStore();
  const [showDetails, setShowDetails] = useState(false);
  const [timeOffline, setTimeOffline] = useState<number | null>(null);

  const pendingCount = getPendingCount();
  const failedCount = queue.filter(item => item.status === 'failed').length;

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  // Update time offline periodically
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (!isOnline) {
      interval = setInterval(async () => {
        const status = await getSyncStatus();
        setTimeOffline(status.timeSinceLastOnline);
      }, 60000); // Update every minute
      
      // Initial check
      getSyncStatus().then(status => {
        setTimeOffline(status.timeSinceLastOnline);
      });
    }
    
    return () => {
      if (interval) clearInterval(interval);
      setTimeOffline(null);
    };
  }, [isOnline]);

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleTimeString();
  };

  const formatTimeOffline = (ms: number | null) => {
    if (ms === null) return '';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h offline`;
    if (hours > 0) return `${hours}h ${minutes % 60}m offline`;
    if (minutes > 0) return `${minutes}m offline`;
    return 'Just went offline';
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'attempt': return 'Game Attempt';
      case 'shop': return 'Shop';
      case 'item': return 'Item';
      case 'nominationItem': return 'Nomination Item';
      case 'customerNomination': return 'Nomination';
      default: return type;
    }
  };

  const handleSync = async () => {
    onManualSync?.();
    await triggerSync();
  };
  
  const handleForceSync = async () => {
    onManualSync?.();
    await forceSyncNow();
  };

  if (pendingCount === 0 && isOnline) {
    return null; // Don't show if everything is synced and online
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Summary Card */}
      <div 
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg cursor-pointer
          ${!isOnline ? 'bg-amber-500' : pendingCount > 0 ? 'bg-blue-600' : 'bg-green-600'}
          text-white
        `}
        onClick={() => setShowDetails(!showDetails)}
      >
        {!isOnline ? (
          <WifiOff className="w-5 h-5" />
        ) : pendingCount > 0 ? (
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
        ) : (
          <Wifi className="w-5 h-5" />
        )}
        
        <div className="flex flex-col">
          <span className="font-semibold text-sm">
            {!isOnline ? 'Offline' : pendingCount > 0 ? `${pendingCount} Pending` : 'All Synced'}
          </span>
          {lastSyncTime && (
            <span className="text-xs opacity-80">
              Last sync: {formatTime(lastSyncTime)}
            </span>
          )}
          {timeOffline && (
            <span className="text-xs opacity-80 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeOffline(timeOffline)}
            </span>
          )}
        </div>

        {pendingCount > 0 && (
          <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </div>

      {/* Detailed View */}
      {showDetails && (
        <div className="absolute bottom-14 right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 dark:text-white">Sync Queue</h3>
            <div className="flex items-center gap-2">
              {isOnline && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleForceSync();
                  }}
                  disabled={isSyncing}
                  className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                  title="Force Sync (bypass user active)"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}
              {queue.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Clear all pending items? This cannot be undone.')) {
                      clearQueue();
                    }
                  }}
                  className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600"
                  title="Clear Queue"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Queue List */}
          <div className="max-h-64 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>All data synced!</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {queue.map((item) => (
                  <li 
                    key={item.id} 
                    className={`
                      px-4 py-3 flex items-center justify-between
                      ${item.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' : ''}
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {getTypeLabel(item.type)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {item.lastError && (
                        <p className="text-xs text-red-500 mt-1">{item.lastError}</p>
                      )}
                      {item.retryCount && item.retryCount > 0 && (
                        <p className="text-xs text-amber-500 mt-1">Retries: {item.retryCount}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {item.status === 'pending' && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                          Pending
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                          Failed
                        </span>
                      )}
                      {item.status === 'synced' && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(item.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span>{failedCount > 0 && `${failedCount} failed`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
