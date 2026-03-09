import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetoFun - Win Amazing Rewards!",
  description: "Promotional reward game - Play lucky number games and win exciting prizes!",
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  themeColor: "#0A1628",
};

// Service Worker Registration (Client-side only)
function ServiceWorkerRegistration() {
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
    
    // Handle online/offline events
    window.addEventListener('online', () => {
      console.log('Back online');
      window.dispatchEvent(new CustomEvent('app-online'));
    });
    
    window.addEventListener('offline', () => {
      console.log('Gone offline');
      window.dispatchEvent(new CustomEvent('app-offline'));
    });
  }
  return null;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
