'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUIStore, useShopStore, useAuthStore } from '@/store';
import { localShops, localAdmins } from '@/lib/local-db';
import { getDeviceId } from '@/lib/device';
import type { Admin } from '@/types';

const LoginPage = dynamic(() => import('@/components/LoginPage'), { ssr: false });
const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), { ssr: false });
const GameMode = dynamic(() => import('@/components/GameMode'), { ssr: false });

export default function Home() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const { currentView, setCurrentView } = useUIStore();
  const { setShops, setCurrentShop, setShops: setLocalShops } = useShopStore();
  const { setAdmin, admin } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authData = localStorage.getItem('metofun-auth');
        if (authData) {
          const adminData: Admin = JSON.parse(authData);
          if (adminData && adminData.isActive) {
            // Verify admin exists in local database to prevent localStorage tampering
            const localAdmin = await localAdmins.getAll();
            const verifiedAdmin = localAdmin.find(a => a.id === adminData.id || a.email === adminData.email);
            if (!verifiedAdmin) {
              // Admin record not found locally - clear invalid auth
              localStorage.removeItem('metofun-auth');
              localStorage.removeItem('metofun-auth-pw');
              setReady(true);
              setLoading(false);
              return;
            }
            // Use verified admin data from database, not localStorage
            setAdmin(verifiedAdmin);
            
            if (verifiedAdmin.level === 'shop_admin') {
              const deviceId = getDeviceId();
              let shop = await localShops.getByDeviceId(deviceId);
              if (!shop) {
                const shops = await localShops.getAll();
                shop = shops.find(s => s.adminEmail?.toLowerCase() === verifiedAdmin.email?.toLowerCase());
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

  useEffect(() => {
    if (admin && currentView === 'login') {
      if (admin.level === 'shop_admin') {
        setCurrentView('customer');
      } else {
        setCurrentView('admin');
      }
    }
  }, [admin, currentView, setCurrentView]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  if (currentView === 'admin') {
    return <AdminDashboard />;
  }

  if (currentView === 'customer') {
    return <GameMode />;
  }

  return <LoginPage />;
}
