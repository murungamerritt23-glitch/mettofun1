'use client';

import { useEffect, useState } from 'react';
import LoginPage from '@/components/LoginPage';
import { useUIStore, useShopStore, useAuthStore } from '@/store';
import { rtdbShops } from '@/lib/firebase';
import { initDB, localAdmins, localShops } from '@/lib/local-db';

export default function Home() {
  const [ready, setReady] = useState(false);
  const { currentView, setCurrentView } = useUIStore();
  const { setShops, setCurrentShop } = useShopStore();
  const { setAdmin } = useAuthStore();

  useEffect(() => {
    init().then(() => setReady(true));
  }, []);

  const init = async () => {
    try {
      await initDB();
      
      let shops = await localShops.getAll();
      if (shops.length === 0) {
        try { shops = await rtdbShops.getAll(); } catch {}
      }
      setShops(shops);
      
      const admins = await localAdmins.getAll();
      if (admins.length > 0) {
        const admin = admins[0];
        setAdmin(admin);
        
        const assigned = admin.assignedShops || [];
        if (admin.level === 'shop_admin' && assigned.length > 0) {
          const shop = shops.find(s => assigned.includes(s.id));
          if (shop) {
            setCurrentShop(shop);
            setCurrentView('customer');
          } else {
            setCurrentView('admin');
          }
        } else {
          setCurrentView(admin.level === 'shop_admin' ? 'customer' : 'admin');
        }
      }
    } catch (e) {
      console.error('Init error:', e);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  return <LoginPage />;
}
