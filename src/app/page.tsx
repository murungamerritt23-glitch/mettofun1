'use client';

import { useEffect, useState } from 'react';
import LoginPage from '@/components/LoginPage';
import { useUIStore, useShopStore, useAuthStore } from '@/store';
import { localShops } from '@/lib/local-db';
import { getDeviceId } from '@/lib/device';
import type { Admin } from '@/types';

export default function Home() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const { currentView, setCurrentView } = useUIStore();
  const { setShops, setCurrentShop, setShops: setLocalShops } = useShopStore();
  const { setAdmin } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authData = localStorage.getItem('metofun-auth');
        if (authData) {
          const admin: Admin = JSON.parse(authData);
          if (admin && admin.isActive) {
            setAdmin(admin);
            
            if (admin.level === 'shop_admin') {
              const deviceId = getDeviceId();
              let shop = await localShops.getByDeviceId(deviceId);
              if (!shop) {
                const shops = await localShops.getAll();
                shop = shops.find(s => s.adminEmail?.toLowerCase() === admin.email?.toLowerCase());
              }
              if (shop) {
                setCurrentShop(shop);
                setCurrentView('customer');
              } else {
                setCurrentView('admin');
              }
            } else {
              const shops = await localShops.getAll();
              setShops(shops);
              setCurrentView('admin');
            }
          }
        }
      } catch (err) {
        console.error('Auth restore error:', err);
      } finally {
        setReady(true);
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      checkAuth();
    }, 500);
    return () => clearTimeout(timer);
  }, [setAdmin, setCurrentView, setCurrentShop, setShops]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return <LoginPage />;
}
