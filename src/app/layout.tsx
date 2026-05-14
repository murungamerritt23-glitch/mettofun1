import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SyncProvider } from "@/components/SyncProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import "@/lib/error-handlers"; // Global error handlers

export const metadata: Metadata = {
  title: "EtoFun - Win Amazing Rewards!",
  description: "Promotional reward game - Play lucky number games and win exciting prizes!",
  manifest: "/manifest.json",
  icons: {
    icon: "/metofun-logo.png",
    apple: "/metofun-logo.png",
  },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorBoundary>
          <SyncProvider />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
