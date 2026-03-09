"use client";

import { useEffect } from "react";
import { initSyncService, processSyncQueue } from "@/lib/sync-service";

export function SyncProvider() {
  useEffect(() => {
    // Initialize sync service
    const cleanup = initSyncService();
    
    // Listen for custom sync events
    const handleSyncRequested = () => {
      console.log('[Layout] Sync requested');
      processSyncQueue();
    };
    
    const handleOnline = () => {
      console.log('[Layout] Back online, triggering sync');
      processSyncQueue();
    };
    
    window.addEventListener('app-sync-requested', handleSyncRequested);
    window.addEventListener('app-online', handleOnline);
    
    // Handle service worker registration
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered:', registration.scope);
            
            // Listen for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available
                    console.log('New version available');
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.log('SW registration failed:', err);
          });
        
        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SYNC_REQUESTED') {
            console.log('Sync requested from SW');
            // Trigger sync in the app
            window.dispatchEvent(new CustomEvent('app-sync-requested'));
          }
        });
      });
    }
    
    // Handle online/offline events
    window.addEventListener('online', () => {
      console.log('Back online');
      window.dispatchEvent(new CustomEvent('app-online'));
    });
    
    window.addEventListener('offline', () => {
      console.log('Gone offline');
      window.dispatchEvent(new CustomEvent('app-offline'));
    });
    
    return () => {
      cleanup();
      window.removeEventListener('app-sync-requested', handleSyncRequested);
      window.removeEventListener('app-online', handleOnline);
    };
  }, []);
  
  return null;
}
