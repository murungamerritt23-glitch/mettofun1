'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUIStore, useShopStore, useAuthStore } from '@/store';
import { localShops, localAdmins } from '@/lib/local-db';
import { rtdbAdmins } from '@/lib/firebase';
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
      // Show UI immediately first
      setReady(true);
      setLoading(false);
      
      try {
        const authData = localStorage.getItem('metofun-auth');
        if (authData) {
          const adminData: Admin = JSON.parse(authData);
          if (adminData && adminData.isActive) {
            // Validate admin level
            if (!['super_admin', 'agent_admin', 'shop_admin'].includes(adminData.level)) {
              localStorage.removeItem('metofun-auth');
              localStorage.removeItem('metofun-auth-pw');
              setReady(true);
              setLoading(false);
              return;
            }
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
            
            // Skip blocking RTDB sync - do in background only
            if (verifiedAdmin.level === 'shop_admin') {
              // Load shop first, then set view
              localShops.getAll().then((allShops: any[]) => {
                const deviceId = getDeviceId();
                let shop = allShops.find(s => s.adminEmail?.toLowerCase() === verifiedAdmin.email?.toLowerCase());
                if (!shop && verifiedAdmin.assignedShops?.length) {
                  shop = allShops.find(s => verifiedAdmin.assignedShops!.includes(s.id));
                }
                if (!shop) {
                  const shopsByDevice = allShops.filter(s => s.deviceId === deviceId);
                  if (shopsByDevice.length === 1) shop = shopsByDevice[0];
                }
                if (shop) {
                  setCurrentShop(shop);
                  setCurrentView('customer');
                }
              }).catch(() => setCurrentView('admin'));
            } else {
              // super_admin or agent_admin - load shops in background
              localShops.getAll().then((shops: any[]) => {
                setShops(shops);
                setCurrentView('admin');
              }).catch(() => setCurrentView('admin'));
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
