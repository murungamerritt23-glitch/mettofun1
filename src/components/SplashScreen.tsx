'use client';

import { useState, useEffect } from 'react';
import { useUIStore } from '@/store';

export default function SplashScreen() {
  const { showSplash, setShowSplash } = useUIStore();

  useEffect(() => {
    // Show splash for max 1.5 seconds then hide
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [setShowSplash]);

  if (!showSplash) return null;

  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center p-4">
      <img
        src="/metofun-logo.png"
        alt="ETO FUN"
        className="w-48 h-auto mb-8"
      />
      <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
