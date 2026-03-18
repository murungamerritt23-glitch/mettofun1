import { useCallback } from 'react';
import { useAuthStore } from '@/store';
import { rtdbAdmins, firebaseAuth } from '@/lib/firebase';
import { localAdmins } from '@/lib/local-db';
import type { Admin, AdminLevel, AdminPermissions } from '@/types';
import { ADMIN_PERMISSIONS } from '@/types';

interface UseAuthReturn {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: AdminPermissions | null;
  hasPermission: (permission: keyof AdminPermissions) => boolean;
  isSuperAdmin: boolean;
  isAgentAdmin: boolean;
  isShopAdmin: boolean;
  canAccessShop: (shopId: string) => boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const {
    admin,
    isAuthenticated,
    isLoading,
    error,
    setAdmin,
    setLoading,
    setError,
    logout: storeLogout,
    checkSession: checkSessionResult
  } = useAuthStore();

  const permissions = admin ? ADMIN_PERMISSIONS[admin.level] : null;

  const hasPermission = useCallback((permission: keyof AdminPermissions): boolean => {
    if (!permissions) return false;
    return permissions[permission];
  }, [permissions]);

  const isSuperAdmin = admin?.level === 'super_admin';
  const isAgentAdmin = admin?.level === 'agent_admin';
  const isShopAdmin = admin?.level === 'shop_admin';

  const canAccessShop = useCallback((shopId: string): boolean => {
    if (!admin) return false;
    if (isSuperAdmin) return true;
    if (isAgentAdmin && admin.assignedShops?.includes(shopId)) return true;
    if (isShopAdmin && admin.assignedShops?.includes(shopId)) return true;
    return false;
  }, [admin, isSuperAdmin, isAgentAdmin, isShopAdmin]);

  const refreshAdmin = useCallback(async (): Promise<void> => {
    if (!admin?.id) return;
    
    try {
      const firebaseAdmin = await rtdbAdmins.get(admin.id);
      if (firebaseAdmin) {
        const updatedAdmin: Admin = {
          ...admin,
          ...firebaseAdmin,
          id: admin.id
        };
        await localAdmins.save(updatedAdmin);
        setAdmin(updatedAdmin);
      } else {
        await storeLogout();
      }
    } catch (e) {
      console.error('Failed to refresh admin:', e);
    }
  }, [admin, setAdmin, storeLogout]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      const result = await firebaseAuth.signIn(email, password);
      
      if (result.error || !result.user) {
        const errorMsg = result.error || 'Login failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const uid = result.user.uid;
      const firebaseAdmin = await rtdbAdmins.get(uid);

      if (!firebaseAdmin) {
        await firebaseAuth.signOut();
        const errorMsg = 'Access denied. Admin record not found. Contact super admin.';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (firebaseAdmin.isActive === false) {
        await firebaseAuth.signOut();
        const errorMsg = 'Access denied. Your account has been deactivated.';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!['super_admin', 'agent_admin', 'shop_admin'].includes(firebaseAdmin.level)) {
        await firebaseAuth.signOut();
        const errorMsg = 'Access denied. Invalid admin role.';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const adminData: Admin = {
        id: uid,
        email: firebaseAdmin.email || email,
        phone: firebaseAdmin.phone || '',
        name: firebaseAdmin.name || email.split('@')[0],
        level: firebaseAdmin.level as AdminLevel,
        createdAt: firebaseAdmin.createdAt || new Date(),
        lastLogin: new Date(),
        isActive: firebaseAdmin.isActive ?? true,
        region: firebaseAdmin.region || 'Default Region',
        assignedShops: firebaseAdmin.assignedShops || [],
        deviceId: firebaseAdmin.deviceId,
        deviceLocked: firebaseAdmin.deviceLocked ?? false
      };

      await localAdmins.save(adminData);
      setAdmin(adminData);

      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [setAdmin, setLoading, setError]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await firebaseAuth.signOut();
    } catch (e) {
      console.error('Firebase sign out error:', e);
    }
    await localAdmins.delete(admin?.id || '');
    storeLogout();
  }, [admin, storeLogout]);

  return {
    admin,
    isAuthenticated,
    isLoading,
    error,
    permissions,
    hasPermission,
    isSuperAdmin,
    isAgentAdmin,
    isShopAdmin,
    canAccessShop,
    login,
    logout,
    refreshAdmin
  };
}

export function useRequireAuth(requiredLevel?: AdminLevel): { authorized: boolean; admin: Admin | null } {
  const { admin, isAuthenticated, checkSession } = useAuthStore();
  const checkSessionResult = checkSession();

  if (!isAuthenticated || !checkSessionResult) {
    return { authorized: false, admin: null };
  }

  if (requiredLevel && admin?.level !== requiredLevel) {
    const levelHierarchy = { super_admin: 3, agent_admin: 2, shop_admin: 1 };
    if ((levelHierarchy[admin?.level || 'shop_admin'] as number) < (levelHierarchy[requiredLevel] as number)) {
      return { authorized: false, admin: null };
    }
  }

  return { authorized: true, admin };
}

export function useRequirePermission(permission: keyof AdminPermissions): boolean {
  const { admin, isAuthenticated, checkSession } = useAuthStore();
  const checkSessionResult = checkSession();

  if (!isAuthenticated || !checkSessionResult || !admin) {
    return false;
  }

  return ADMIN_PERMISSIONS[admin.level][permission];
}
