'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { useUIStore } from '@/store';

export default function SplashScreen() {
  const { showSplash, setShowSplash } = useUIStore();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setShowSplash(false), 500);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [setShowSplash]);

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="splash-container"
        >
          {/* Animated shopping cart with gold ball */}
          <div className="relative mb-8">
            {/* Golden ball */}
            <motion.div
              className="absolute -top-4 left-1/2 w-8 h-8 rounded-full"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #fcd34d, #f59e0b, #b45309)',
                boxShadow: '0 0 20px #f59e0b, 0 0 40px rgba(245,158,11,0.5)'
              }}
              animate={{
                x: [0, 30, -30, 0],
                y: [0, -40, 0, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Shopping cart */}
            <motion.div
              animate={{
                y: [0, -10, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <ShoppingCart 
                size={80} 
                className="text-gold-500"
                style={{ color: '#f59e0b' }}
              />
            </motion.div>
            
            {/* Sparkles */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Sparkles 
                className="absolute -top-2 -right-2 text-gold-300"
                size={24}
                style={{ color: '#fcd34d' }}
              />
              <Sparkles 
                className="absolute top-4 -left-2 text-gold-400"
                size={16}
                style={{ color: '#fbbf24' }}
              />
            </motion.div>
          </div>

          {/* Logo text */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="gold-gradient-text text-5xl font-bold mb-2"
          >
            MetoFun
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-400 text-lg mb-8"
          >
            Win Rewards. Play Lucky.
          </motion.p>

          {/* Progress bar */}
          <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)'
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.7 }}
            className="text-gray-500 text-sm mt-4"
          >
            Loading...
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
