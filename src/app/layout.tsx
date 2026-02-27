import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetoFun - Win Amazing Rewards!",
  description: "Promotional reward game - Play lucky number games and win exciting prizes!",
  viewport: "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5",
  themeColor: "#4F46E5",
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

// Service Worker Registration (Client-side only)
function ServiceWorkerRegistration() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration failed:', err);
      });
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
