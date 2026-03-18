'use client';

import { useState, useEffect } from 'react';
import { useUIStore } from '@/store';

export default function SplashScreen() {
  const { showSplash, setShowSplash } = useUIStore();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setShowSplash(false), 300);
          return 100;
        }
        return prev + Math.random() * 20;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [setShowSplash]);

  if (!showSplash) return null;

  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center p-4">
      {/* Static PNG Logo - App Identity */}
      <img
        src="/metofun-logo.png"
        alt="ETO FUN"
        className="w-48 h-auto mb-8"
      />
      
      {/* Simple Loading Bar */}
      <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-yellow-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <p className="text-amber-400 text-lg">Loading...</p>
    </div>
  );
}
