'use client';

import { useState, useEffect } from 'react';
import { useSyncStore } from '@/store';
import { useUIStore } from '@/store';
import { RefreshCw, Wifi, WifiOff, AlertCircle, Check, Trash2 } from 'lucide-react';

interface SyncStatusProps {
  onManualSync?: () => void;
}

export function SyncStatus({ onManualSync }: SyncStatusProps) {
  const { queue, isSyncing, lastSyncTime, removeFromQueue, clearQueue, getPendingCount } = useSyncStore();
  const { isOnline, setOnline } = useUIStore();
  const [showDetails, setShowDetails] = useState(false);

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

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleTimeString();
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'attempt': return 'Game Attempt';
      case 'shop_update': return 'Shop Update';
      case 'item_update': return 'Item Update';
      case 'settings_update': return 'Settings';
      default: return type;
    }
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
              {isOnline && pendingCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onManualSync?.();
                  }}
                  disabled={isSyncing}
                  className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  title="Sync Now"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              )}
              {queue.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Clear all pending items?')) {
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
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                      {item.lastError && (
                        <p className="text-xs text-red-500 mt-1">{item.lastError}</p>
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
            <span>{isOnline ? 'Online' : 'Offline'}</span>
            <span>{failedCount > 0 && `${failedCount} failed`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
