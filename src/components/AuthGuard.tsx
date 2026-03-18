'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useUIStore } from '@/store';
import type { AdminLevel, AdminPermissions } from '@/types';
import { ADMIN_PERMISSIONS } from '@/types';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredLevel?: AdminLevel;
  requiredPermission?: keyof AdminPermissions;
  fallback?: React.ReactNode;
}

export function AuthGuard({ 
  children, 
  requiredLevel, 
  requiredPermission,
  fallback = null 
}: AuthGuardProps) {
  const router = useRouter();
  const { admin, isAuthenticated, isLoading, checkSession } = useAuthStore();
  const { setCurrentView } = useUIStore();

  useEffect(() => {
    if (isLoading) return;

    const sessionValid = checkSession();
    
    if (!isAuthenticated || !sessionValid) {
      setCurrentView('login');
      return;
    }

    if (requiredLevel && admin?.level !== requiredLevel) {
      const levelHierarchy = { super_admin: 3, agent_admin: 2, shop_admin: 1 };
      const adminLevel = levelHierarchy[admin?.level || 'shop_admin'];
      const requiredLevelValue = levelHierarchy[requiredLevel];
      
      if (adminLevel < requiredLevelValue) {
        setCurrentView('login');
        return;
      }
    }

    if (requiredPermission && admin) {
      const permissions = ADMIN_PERMISSIONS[admin.level];
      if (!permissions[requiredPermission]) {
        setCurrentView('login');
        return;
      }
    }
  }, [isAuthenticated, isLoading, admin, requiredLevel, requiredPermission, checkSession, setCurrentView]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1628]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  const sessionValid = checkSession();
  
  if (!isAuthenticated || !sessionValid) {
    return <>{fallback}</>;
  }

  if (requiredLevel && admin?.level !== requiredLevel) {
    const levelHierarchy = { super_admin: 3, agent_admin: 2, shop_admin: 1 };
    const adminLevel = levelHierarchy[admin?.level || 'shop_admin'];
    const requiredLevelValue = levelHierarchy[requiredLevel];
    
    if (adminLevel < requiredLevelValue) {
      return <>{fallback}</>;
    }
  }

  if (requiredPermission && admin) {
    const permissions = ADMIN_PERMISSIONS[admin.level];
    if (!permissions[requiredPermission]) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

export function useRequireAuth(redirectToLogin = true) {
  const router = useRouter();
  const { admin, isAuthenticated, isLoading, checkSession } = useAuthStore();
  const { setCurrentView } = useUIStore();

  useEffect(() => {
    if (isLoading) return;

    const sessionValid = checkSession();
    
    if (!isAuthenticated || !sessionValid) {
      if (redirectToLogin) {
        setCurrentView('login');
      }
    }
  }, [isAuthenticated, isLoading, checkSession, redirectToLogin, setCurrentView]);

  const sessionValid = checkSession();
  
  if (isLoading) {
    return { authorized: false, loading: true };
  }

  if (!isAuthenticated || !sessionValid) {
    return { authorized: false, loading: false };
  }

  return { authorized: true, loading: false, admin };
}

export function useHasPermission(permission: keyof AdminPermissions): boolean {
  const { admin, isAuthenticated, checkSession } = useAuthStore();
  
  if (!isAuthenticated || !admin) return false;
  
  const sessionValid = checkSession();
  if (!sessionValid) return false;
  
  return ADMIN_PERMISSIONS[admin.level][permission];
}

export function useCanAccessShop(shopId: string): boolean {
  const { admin, isAuthenticated, checkSession } = useAuthStore();
  
  if (!isAuthenticated || !admin) return false;
  
  const sessionValid = checkSession();
  if (!sessionValid) return false;
  
  if (admin.level === 'super_admin') return true;
  if (admin.level === 'agent_admin' || admin.level === 'shop_admin') {
    return admin.assignedShops?.includes(shopId) || false;
  }
  
  return false;
}
