'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Store, Package, Users, BarChart3, 
  Settings, LogOut, Menu, X, Plus, Edit, Trash2,
  Save, Smartphone, Power, PowerOff, Copy, UserCheck, UserPlus, Zap, ShoppingCart,
  Upload, RefreshCw, FlaskConical, Gift, Star, Heart, Lock
} from 'lucide-react';
import { useAuthStore, useShopStore, useItemStore, useUIStore, useGameStore } from '@/store';
import { localItems, localAttempts, localAdmins, localPendingCustomers, clearAllData, localShops, localSettings, localNominationItems } from '@/lib/local-db';
import { rtdbShops, rtdbAdmins, firebaseDb, firebaseSettings, firebaseAdmins } from '@/lib/firebase';
import { saveItemWithSync, saveShopWithSync, saveNominationItemWithSync, triggerSync, isOnline, setUserActive } from '@/lib/sync-service';
import { generateDefaultItems, calculateShopAnalytics, validateItemPrice, calculateBoxConfiguration, generateSecureRandomNumber } from '@/lib/game-utils';
import { registerCurrentDevice, getDeviceId } from '@/lib/device';
import type { Shop, Item, AdminPermissions, Admin, AdminLevel, PendingCustomer, SubscriptionTier, ItemOfTheDay, NominationItem } from '@/types';
import { ADMIN_PERMISSIONS, SUBSCRIPTION_CHANNELS } from '@/types';

type TabType = 'dashboard' | 'shops' | 'items' | 'qualifyingPurchase' | 'attempts' | 'analytics' | 'settings' | 'customers' | 'myShop' | 'staff';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [termsSaved, setTermsSaved] = useState(false);
  // Item of the Day state
  const [itemOfTheDay, setItemOfTheDay] = useState<ItemOfTheDay | null>(null);
  const [isEditingItemOfDay, setIsEditingItemOfDay] = useState(false);
  const [itemOfDayForm, setItemOfDayForm] = useState({ name: '', value: '', imageUrl: '' });
  const [itemOfDaySaved, setItemOfDaySaved] = useState(false);

  // Customer management state (for 'customers' tab)
  const [pendingCustomers, setPendingCustomers] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ phoneNumber: '', purchaseAmount: '', itemId: '' });
  const [itemsList, setItemsList] = useState<Item[]>([]);
  const [demoQualifyingPurchase, setDemoQualifyingPurchase] = useState<number>(0);
  const [qpInput, setQpInput] = useState<string>(''); // Local state for qualifying purchase input
  const [qpSaving, setQpSaving] = useState(false); // Saving state for qualifying purchase
  
  // Top nominations state
  const [topNominations, setTopNominations] = useState<NominationItem[]>([]);
  const [nominationsLoading, setNominationsLoading] = useState(false);
  
  // Nomination Items Management state
  const [nominationItems, setNominationItems] = useState<NominationItem[]>([]);
  const [isEditingNominationItems, setIsEditingNominationItems] = useState(false);
  const [editingNominationItem, setEditingNominationItem] = useState<NominationItem | null>(null);
  const [isCreatingNominationItem, setIsCreatingNominationItem] = useState(false);
  const [nominationItemsLoading, setNominationItemsLoading] = useState(false);

  // Password protection state
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Collapsible shop groups in attempts view
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  
  const toggleShopExpanded = (shopId: string) => {
    setExpandedShops(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shopId)) {
        newSet.delete(shopId);
      } else {
        newSet.add(shopId);
      }
      return newSet;
    });
  };

  const { admin, logout } = useAuthStore();
  const { currentShop, setCurrentShop } = useShopStore();
  const { items, setItems } = useItemStore();
  const { setCurrentView } = useUIStore();
  const { setCustomerSession, setSelectedItem, setGameStatus, setCorrectNumber, setThresholdNumber, setDemoMode, isTestMode, setTestMode, clearTestData } = useGameStore();

  // Default password
  const DEFAULT_PASSWORD = '0000';

  // Handle password verification
  const handlePasswordSubmit = () => {
    const storedPassword = admin?.dashboardPassword || DEFAULT_PASSWORD;
    if (passwordInput === storedPassword) {
      setIsPasswordVerified(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect PIN');
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      alert('PIN must be exactly 4 digits');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('PINs do not match');
      return;
    }
    
    const currentPassword = admin?.dashboardPassword || DEFAULT_PASSWORD;
    if (passwordInput !== currentPassword) {
      alert('Current PIN is incorrect');
      return;
    }

    try {
      const updatedAdmin = { ...admin, dashboardPassword: newPassword } as Admin;
      await localAdmins.save(updatedAdmin);
      useAuthStore.getState().setAdmin(updatedAdmin);
      
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordInput('');
      alert('PIN changed successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change PIN');
    }
  };

  // Load customers data when shop changes
  useEffect(() => {
    if (activeTab === 'customers' && currentShop) {
      localPendingCustomers.getByShop(currentShop.id).then(setPendingCustomers);
      localItems.getByShop(currentShop.id).then(setItemsList);
    }
  }, [activeTab, currentShop]);

  // Initialize qualifying purchase input when currentShop changes (shop switched)
  useEffect(() => {
    if (currentShop) {
      setQpInput(String(currentShop.qualifyingPurchase || 0));
      loadTopNominations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.id]);

  // Load top nominations for the current shop
  const loadTopNominations = async () => {
    if (!currentShop) return;
    setNominationsLoading(true);
    try {
      const nominations = await localNominationItems.getByShop(currentShop.id);
      // Get top 10 with nominations > 0, sorted by count descending
      const top10 = nominations
        .filter(item => item.nominationCount > 0)
        .slice(0, 10);
      setTopNominations(top10);
    } catch (error) {
      console.error('Error loading nominations:', error);
    } finally {
      setNominationsLoading(false);
    }
  };

  // Load all nomination items for editing
  const loadNominationItems = async () => {
    if (!currentShop) return;
    setNominationItemsLoading(true);
    try {
      const items = await localNominationItems.getByShop(currentShop.id);
      setNominationItems(items);
    } catch (error) {
      console.error('Error loading nomination items:', error);
    } finally {
      setNominationItemsLoading(false);
    }
  };

  // Open nomination items editor
  const handleOpenNominationItemsEditor = async () => {
    await loadNominationItems();
    setIsEditingNominationItems(true);
  };

  // Save nomination item
  const handleSaveNominationItem = async (item: NominationItem) => {
    await saveNominationItemWithSync(item, !editingNominationItem);
    setEditingNominationItem(null);
    setIsCreatingNominationItem(false);
    loadNominationItems();
    loadTopNominations();
  };

  // Delete nomination item
  const handleDeleteNominationItem = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this nomination item?')) {
      await localNominationItems.delete(itemId);
      loadNominationItems();
      loadTopNominations();
    }
  };

  // Toggle nomination item active status
  const handleToggleNominationItemActive = async (item: NominationItem) => {
    const updatedItem = { ...item, isActive: !item.isActive, updatedAt: new Date() };
    await saveNominationItemWithSync(updatedItem, false);
    loadNominationItems();
  };

  // Get permissions based on admin level - use direct check for shop_admin to ensure reliability
  const isShopAdmin = admin?.level === 'shop_admin';
  const isSuperAdmin = admin?.level === 'super_admin';
  const isAgentAdmin = admin?.level === 'agent_admin';
  const isAdmin = admin?.level === 'super_admin' || admin?.level === 'agent_admin';
  const needsPassword = true;

  const defaultPermissions: AdminPermissions = {
    canManageAllShops: false,
    canManageAssignedShops: false,
    canOnboardShops: false,
    canDeleteShops: false,
    canActivateShops: false,
    canAssignSubscription: false,
    canManageAdmins: false,
    canAssignShops: false,
    canEditQualifyingPurchase: false,
    canEditItems: false,
    canViewAnalytics: false,
    canViewGlobalAnalytics: false,
    canEditTermsHelp: false,
    canManageVersions: false,
    canBackupRestore: false,
    canResetDevices: false,
    canViewAllShops: false,
  };
  const permissions: AdminPermissions = admin?.level ? 
    ((ADMIN_PERMISSIONS as any)[admin.level] || defaultPermissions) : defaultPermissions;
  // Override canEditQualifyingPurchase for shop_admin
  const canEditQualifyingPurchase = isShopAdmin || permissions?.canEditQualifyingPurchase;

  // Load shops on mount
  useEffect(() => {
    const loadShops = async () => {
      try {
        // Get current shop from store first
        const storedCurrentShop = useShopStore.getState().currentShop;
        
        // Check if this is a shop_admin with assigned shops
        const isShopAdmin = admin?.level === 'shop_admin';
        const assignedShopIds = admin?.assignedShops || [];
        
        // Function to filter shops by assigned shops for shop_admin
        const filterByAssignedShops = (shopList: Shop[]): Shop[] => {
          if (isShopAdmin && assignedShopIds.length > 0) {
            return shopList.filter(s => assignedShopIds.includes(s.id));
          }
          return shopList;
        };
        
        // Function to auto-select first shop if none selected
        const autoSelectShop = async (shopList: Shop[]) => {
          // For super_admin and agent_admin, load all attempts (grouped by shop)
          if (admin?.level === 'super_admin' || admin?.level === 'agent_admin') {
            if (!storedCurrentShop && shopList.length > 0) {
              setCurrentShop(shopList[0]);
            } else if (storedCurrentShop) {
              const updatedShop = shopList.find(s => s.id === storedCurrentShop.id);
              if (updatedShop) {
                setCurrentShop(updatedShop);
              }
            }
            // Load ALL attempts for super admin/agent admin
            try {
              const allAttempts = await localAttempts.getAll();
              setAttempts(allAttempts);
            } catch (error) {
              console.error('Error loading attempts:', error);
            }
          } else {
            // shop_admin: load attempts for selected shop only
            if (!storedCurrentShop && shopList.length > 0) {
              setCurrentShop(shopList[0]);
              // Load attempts for the selected shop
              try {
                const shopAttempts = await localAttempts.getByShop(shopList[0].id);
                setAttempts(shopAttempts);
              } catch (error) {
                console.error('Error loading shop attempts:', error);
              }
            } else if (storedCurrentShop) {
              // Always update currentShop with fresh data from Firebase/local storage
              // This ensures qualifying purchase and other fields are up-to-date
              const updatedShop = shopList.find(s => s.id === storedCurrentShop.id);
              if (updatedShop) {
                setCurrentShop(updatedShop);
                // Load attempts for the current shop
                try {
                  const shopAttempts = await localAttempts.getByShop(updatedShop.id);
                  setAttempts(shopAttempts);
                } catch (error) {
                  console.error('Error loading shop attempts:', error);
                }
              }
            }
          }
        };

        // Load from local first (always works), then try RTDB in background
        const loadShopsFromLocal = async () => {
          const localShopList = await localShops.getAll();
          if (admin?.level === 'super_admin') {
            setShops(localShopList);
            autoSelectShop(localShopList);
          } else {
            const activeLocalShops = localShopList.filter((s: Shop) => s.isActive);
            const filteredLocalShops = filterByAssignedShops(activeLocalShops);
            setShops(filteredLocalShops);
            autoSelectShop(filteredLocalShops);
          }
        };

        // Always load local first for offline support
        await loadShopsFromLocal();

        // Then try to sync from RTDB if online (non-blocking)
        const trySyncFromRTDB = async () => {
          try {
            let fbShops;
            if (admin?.level === 'super_admin') {
              fbShops = await rtdbShops.getAll();
            } else {
              fbShops = await rtdbShops.getAllActive();
            }
            if (fbShops && fbShops.length > 0) {
              // Save to local for offline access
              for (const shop of fbShops) {
                await localShops.save(shop);
              }
              if (admin?.level === 'super_admin') {
                setShops(fbShops);
                autoSelectShop(fbShops);
              } else {
                const filteredFbShops = filterByAssignedShops(fbShops);
                setShops(filteredFbShops);
                autoSelectShop(filteredFbShops);
              }
            }
          } catch (err) {
            // RTDB unavailable - already loaded from local above
          }
        };

        // Try RTDB sync in background (don't block UI)
        trySyncFromRTDB();
      } catch (error) {
        console.error('Error in loadShops:', error);
      }
    };
    loadShops();
    localAdmins.getAll().then(setAdmins).catch(console.error);
  }, [admin]);

  // Load terms content for admin
  useEffect(() => {
    if (admin?.level === 'super_admin') {
      firebaseSettings.getSettings().then(settings => {
        setTermsContent(settings.termsContent);
      });
    }
  }, [admin]);

  // Load Item of the Day on mount
  useEffect(() => {
    const loadItemOfDay = async () => {
      // Try local first
      const savedItem = await localSettings.get('itemOfTheDay');
      if (savedItem) {
        setItemOfTheDay(savedItem);
      } else {
        // Try to fetch from RTDB for new devices
        try {
          const { rtdbSettings: rtdbSettingsApi } = await import('@/lib/firebase');
          const rtdbItem = await rtdbSettingsApi.get('itemOfTheDay');
          if (rtdbItem) {
            // Save to local for offline access
            await localSettings.set('itemOfTheDay', rtdbItem);
            setItemOfTheDay(rtdbItem);
          }
        } catch (e) {
          // RTDB fetch failed
        }
      }
    };
    loadItemOfDay();
  }, []);

  // Admin handlers
  const handleSaveAdmin = async (adminData: Admin) => {
    // Check if trying to set as super_admin
    if (adminData.level === 'super_admin') {
      // Check if there's already a super_admin
      const existingAdmins = admins.filter(a => a.level === 'super_admin' && a.id !== adminData.id);
      if (existingAdmins.length > 0) {
        alert('There can only be ONE Super Admin. Please contact the existing Admin to change this.');
        return;
      }
    }
    
    // Save to local database
    await localAdmins.save(adminData);
    
    // Also sync to RTDB
    try {
      await rtdbAdmins.save(adminData);
    } catch (e) {
      console.log('RTDB sync skipped (local only mode)');
    }
    
    setEditingAdmin(null);
    setIsCreatingAdmin(false);
    localAdmins.getAll().then(setAdmins);
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (confirm('Are you sure you want to delete this admin?')) {
      await localAdmins.delete(adminId);
      localAdmins.getAll().then(setAdmins);
    }
  };

  // Define available tabs based on permissions
  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiredPermission: null },
    { id: 'myShop', label: 'My Shop', icon: Store, requiredPermission: 'shop_admin' },
    { id: 'customers', label: 'Customers', icon: ShoppingCart, requiredPermission: 'shop_admin' },
    { id: 'shops', label: 'Shops', icon: Store, requiredPermission: 'canManageAllShops' },
    { id: 'items', label: 'Items', icon: Package, requiredPermission: 'canEditItems' },
    { id: 'qualifyingPurchase', label: 'Qualifying Purchase', icon: Zap, requiredPermission: 'canEditQualifyingPurchase' },
    { id: 'attempts', label: 'Attempts', icon: Users, requiredPermission: 'canViewAnalytics' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, requiredPermission: 'canViewAnalytics' },
    { id: 'staff', label: 'Staff', icon: UserCheck, requiredPermission: 'canManageAdmins' },
    { id: 'settings', label: 'Settings', icon: Settings, requiredPermission: null },
  ];

  // Filter tabs based on permissions
  const tabs = allTabs.filter(tab => {
    // Settings tab is visible to everyone
    if (tab.requiredPermission === null) return true;
    
    // Handle shop_admin specific tabs
    if (admin?.level === 'shop_admin' && tab.requiredPermission === 'shop_admin') {
      return true;
    }
    
    // Also show tab if user is shop_admin (direct check) for edit permissions
    if (admin?.level === 'shop_admin' && (tab.requiredPermission === 'canEditQualifyingPurchase' || tab.requiredPermission === 'canEditItems')) {
      return true;
    }
    
    // Handle staff tab for both canManageAdmins and canAssignShops
    if (tab.requiredPermission === 'canManageAdmins' && (permissions.canManageAdmins || permissions.canAssignShops)) {
      return true;
    }
    
    // Handle shops tab for both canManageAllShops and canManageAssignedShops
    if (tab.requiredPermission === 'canManageAllShops' && (permissions.canManageAllShops || permissions.canManageAssignedShops)) {
      return true;
    }
    
    return (permissions as any)[tab.requiredPermission];
  });

  // Load attempts when tab changes to attempts or dashboard
  useEffect(() => {
    if (activeTab === 'attempts' || activeTab === 'dashboard') {
      if (currentShop) {
        loadAttempts();
      } else if (admin?.level === 'super_admin') {
        loadAllAttempts();
      }
    }
  }, [activeTab, currentShop, admin?.level]);

  // Password protection check
  if (needsPassword && !isPasswordVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-gold max-w-md w-full">
          <h2 className="gold-gradient-text text-2xl font-bold text-center mb-6">Admin Dashboard</h2>
          <p className="text-gray-400 text-center mb-6">Enter your 4-digit PIN to access</p>
          <div className="space-y-4">
            <input
              type="password"
              maxLength={4}
              pattern="[0-9]*"
              inputMode="numeric"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input text-center text-2xl tracking-widest font-mono"
              placeholder="••••"
              autoFocus
            />
            {passwordError && <p className="text-red-400 text-center text-sm">{passwordError}</p>}
            <button onClick={handlePasswordSubmit} className="btn-gold w-full">Unlock</button>
            <button
              onClick={() => { logout(); setCurrentView('login'); }}
              className="mt-4 flex items-center justify-center gap-2 w-full py-2 px-3 bg-red-900/50 text-red-400 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Save terms and conditions
  const handleSaveTerms = async () => {
    const result = await firebaseSettings.updateTerms(termsContent);
    if (result.success) {
      setTermsSaved(true);
      setIsEditingTerms(false);
      setTimeout(() => setTermsSaved(false), 3000);
    }
  };

  // Save Item of the Day
  const handleSaveItemOfDay = async () => {
    if (!itemOfDayForm.name || !itemOfDayForm.value) {
      alert('Please enter item name and value');
      return;
    }
    
    const newItem: ItemOfTheDay = {
      id: 'item-of-the-day',
      name: itemOfDayForm.name,
      value: parseFloat(itemOfDayForm.value) || 0,
      imageUrl: itemOfDayForm.imageUrl || undefined,
      isActive: true,
      likes: itemOfTheDay?.likes || 0,
      createdAt: itemOfTheDay?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    // Save to local for offline support
    await localSettings.set('itemOfTheDay', newItem);
    setItemOfTheDay(newItem);
    
    // Also sync to RTDB for other devices
    try {
      const { rtdbSettings: rtdbSettingsApi } = await import('@/lib/firebase');
      await rtdbSettingsApi.set('itemOfTheDay', newItem);
    } catch (e) {
      // RTDB sync failed, but local save succeeded
    }
    
    setIsEditingItemOfDay(false);
    setItemOfDaySaved(true);
    setTimeout(() => setItemOfDaySaved(false), 3000);
  };

  // Clear Item of the Day
  const handleClearItemOfDay = async () => {
    if (confirm('Are you sure you want to remove the Item of the Day?')) {
      await localSettings.set('itemOfTheDay', null);
      
      // Also clear from RTDB
      try {
        const { rtdbSettings: rtdbSettingsApi } = await import('@/lib/firebase');
        await rtdbSettingsApi.set('itemOfTheDay', null);
      } catch (e) {
        // RTDB sync failed
      }
      setItemOfTheDay(null);
      setItemOfDayForm({ name: '', value: '', imageUrl: '' });
    }
  };

  // Start editing Item of the Day
  const handleEditItemOfDay = () => {
    if (itemOfTheDay) {
      setItemOfDayForm({
        name: itemOfTheDay.name,
        value: String(itemOfTheDay.value),
        imageUrl: itemOfTheDay.imageUrl || ''
      });
    } else {
      setItemOfDayForm({ name: '', value: '', imageUrl: '' });
    }
    setIsEditingItemOfDay(true);
  };

  const handleLogout = async () => {
    // Immediate navigation - don't wait for any cleanup
    setCurrentView('login');
    logout();
  };

  const loadAttempts = async () => {
    if (currentShop) {
      // Pull from RTDB first (non-blocking)
      try {
        const { pullAttemptsFromRTDB } = await import('@/lib/sync-service');
        await pullAttemptsFromRTDB(currentShop.id);
      } catch (e) {
        // RTDB pull failed, use local
      }
      
      const shopAttempts = await localAttempts.getByShop(currentShop.id);
      setAttempts(shopAttempts);
    }
  };

  // Load all attempts (for super admin to view all shops)
  const loadAllAttempts = async () => {
    // Pull from RTDB first (non-blocking)
    try {
      const { pullFromRTDB } = await import('@/lib/sync-service');
      await pullFromRTDB();
    } catch (e) {
      // RTDB pull failed, use local
    }
    
    const allAttempts = await localAttempts.getAll();
    setAttempts(allAttempts);
  };

  const loadItems = async () => {
    if (currentShop) {
      // Pull from RTDB first (non-blocking)
      try {
        const { pullFromRTDB } = await import('@/lib/sync-service');
        await pullFromRTDB(currentShop.id);
      } catch (e) {
        // RTDB pull failed, use local
      }
      
      const shopItems = await localItems.getByShop(currentShop.id);
      setItems(shopItems.length > 0 ? shopItems : generateDefaultItems(currentShop.id));
    }
  };

  const handleSaveShop = async (shop: Shop) => {
    // Check for duplicate shopCode in local shops (case-insensitive)
    const existingByCode = shops.find(s => 
      s.shopCode.toLowerCase() === shop.shopCode.toLowerCase() && 
      s.id !== shop.id // Exclude current shop if editing
    );
    if (existingByCode) {
      alert(`A shop with code "${shop.shopCode}" already exists. Please use a different shop code.`);
      return;
    }
    
    // Check for duplicate deviceId in local shops
    const existingByDevice = shops.find(s => 
      s.deviceId === shop.deviceId && 
      s.id !== shop.id // Exclude current shop if editing
    );
    if (existingByDevice) {
      alert(`This device is already registered to another shop. Each device can only be linked to one shop.`);
      return;
    }
    
    // Check for duplicate adminEmail in local shops
    if (shop.adminEmail) {
      const existingByEmail = shops.find(s => 
        s.adminEmail?.toLowerCase() === shop.adminEmail!.toLowerCase() && 
        s.id !== shop.id
      );
      if (existingByEmail) {
        alert(`A shop with admin email "${shop.adminEmail}" already exists. Each email can only be linked to one shop.`);
        return;
      }
    }
    
    // Also check Firebase for duplicates (in case other devices added shops)
    try {
      const allFbShops = await rtdbShops.getAll();
      const fbDuplicateByCode = allFbShops.find(s => 
        s.shopCode.toLowerCase() === shop.shopCode.toLowerCase() && 
        s.id !== shop.id
      );
      if (fbDuplicateByCode) {
        alert(`A shop with code "${shop.shopCode}" already exists in the system. Please use a different shop code.`);
        return;
      }
      
      const fbDuplicateByDevice = allFbShops.find(s => 
        s.deviceId === shop.deviceId && 
        s.id !== shop.id
      );
      if (fbDuplicateByDevice) {
        alert(`This device is already registered to another shop in the system. Each device can only be linked to one shop.`);
        return;
      }
      
      // Check Firebase for duplicate adminEmail
      if (shop.adminEmail) {
        const fbDuplicateByEmail = allFbShops.find(s => 
          s.adminEmail?.toLowerCase() === shop.adminEmail!.toLowerCase() && 
          s.id !== shop.id
        );
        if (fbDuplicateByEmail) {
          alert(`A shop with admin email "${shop.adminEmail}" already exists in the system. Each email can only be linked to one shop.`);
          return;
        }
      }
    } catch (e) {
      // If Firebase check fails, proceed with local validation (user might be offline)
      console.warn('Could not check Firebase for duplicates:', e);
    }
    
    // Save to local first for offline support
    await saveShopWithSync(shop, !editingShop);
    
    setEditingShop(null);
    setIsCreatingShop(false);
    setUserActive(false);
    
    // Update current shop if this is the active one
    if (currentShop?.id === shop.id) {
      setCurrentShop(shop);
    }
    
    // Update shops list with the saved shop (don't refetch - use saved data)
    const updatedShops = shops.map(s => s.id === shop.id ? shop : s);
    if (!editingShop) {
      updatedShops.push(shop);
    }
    setShops(updatedShops);
  };

  const handleToggleShopActive = async (shop: Shop) => {
    const updatedShop = { ...shop, isActive: !shop.isActive };
    await saveShopWithSync(updatedShop, false);
    // Reload shops
    if (admin?.level === 'super_admin') {
      const allShops = await rtdbShops.getAll();
      setShops(allShops);
    } else {
      const fbShops = await rtdbShops.getAllActive();
      setShops(fbShops);
    }
  };

  const handleUpdateSubscription = async (shopId: string, subscriptionTier: 'basic' | 'medium' | 'pro') => {
    await rtdbShops.update(shopId, { 
      subscriptionTier, 
      subscriptionStatus: 'active' as const 
    });
    await localShops.save({ 
      ...shops.find(s => s.id === shopId)!, 
      subscriptionTier, 
      subscriptionStatus: 'active' 
    });
    // Reload shops
    if (admin?.level === 'super_admin') {
      const allShops = await rtdbShops.getAll();
      setShops(allShops);
    } else {
      const fbShops = await rtdbShops.getAllActive();
      setShops(fbShops);
    }
  };

  const handleDeleteShop = async (shopId: string) => {
    // Only admin can delete shops
    if (admin?.level !== 'super_admin') {
      alert('Only admins can delete shops');
      return;
    }
    
    if (confirm('Are you sure you want to DELETE this shop permanently? This cannot be undone!')) {
      // Hard delete from Firebase
      await rtdbShops.hardDelete(shopId);
      // Delete from local
      await localShops.delete(shopId);
      await localItems.deleteByShop(shopId);
      // Refresh
      if (admin?.level === 'super_admin') {
        const allShops = await rtdbShops.getAll();
        setShops(allShops);
      } else {
        const fbShops = await rtdbShops.getAllActive();
        setShops(fbShops);
      }
    }
  };

  const handleSaveItem = async (item: Item) => {
    await saveItemWithSync(item, !editingItem);
    setEditingItem(null);
    setUserActive(false);
    loadItems();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await localItems.delete(itemId);
      loadItems();
    }
  };

  const handleLockDevice = async () => {
    if (!currentShop) {
      alert('No shop selected.');
      return;
    }
    
    if (currentShop.deviceLocked) {
      alert('Device is already locked to this shop.');
      return;
    }
    
    if (confirm('Lock this device to this shop? The shop can only run games on this device.')) {
      try {
        const deviceId = getDeviceId();
        const updatedShop = { ...currentShop, deviceId: deviceId, deviceLocked: true };
        await localShops.save(updatedShop);
        setCurrentShop(updatedShop);
        setShops(prev => prev.map(s => s.id === updatedShop.id ? updatedShop : s));
        localStorage.setItem('metofun-current-shop', JSON.stringify(updatedShop));
        await rtdbShops.save(updatedShop);
        alert('Device locked successfully!');
      } catch (err) {
        console.error('Error locking device:', err);
        alert('Failed to lock device. Please try again.');
      }
    }
  };

  const handleBackup = async () => {
    const data = {
      shops: await localShops.getAll(),
      items: items,
      attempts: await localAttempts.getAll(),
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metofun-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Dashboard view
  if (activeTab === 'dashboard') {
    // Filter out test attempts from analytics
    const realAttempts = attempts.filter(a => a.isTest !== true);
    const analytics = realAttempts.length > 0 ? calculateShopAnalytics(realAttempts, currentShop?.id || '') : null;
    
    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {/* Analytics - Only for super_admin and shop_admin, hide for agent_admin */}
              {admin?.level !== 'agent_admin' && (
              <>
              {/* Active Shops - Only for super_admin */}
              {admin?.level === 'super_admin' && (
              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gold-900/50 flex items-center justify-center">
                    <Store className="text-gold-500" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Active Shops</p>
                    <p className="text-2xl font-bold text-white">{shops.filter(s => s.isActive).length}</p>
                  </div>
                </div>
              </div>
              )}
              
              {/* Total Attempts - Only for super_admin and shop_admin */}
              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-900/50 flex items-center justify-center">
                    <Users className="text-green-500" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Attempts</p>
                    <p className="text-2xl font-bold text-white">{realAttempts.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center">
                    <Package className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Active Items</p>
                    <p className="text-2xl font-bold text-white">{items.filter(i => i.isActive).length}</p>
                  </div>
                </div>
              </div>
              
              {/* Win Rate - Only for super_admin and shop_admin */}
              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-900/50 flex items-center justify-center">
                    <BarChart3 className="text-purple-500" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Win Rate</p>
                    <p className="text-2xl font-bold text-white">
                      {analytics ? `${analytics.winRate.toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                </div>
              </div>
              </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(isShopAdmin || admin?.level === 'super_admin') && (
              <button
                onClick={() => setCurrentView('customer')}
                className="card hover:border-gold-500 transition-all text-left"
              >
                <Store className="text-gold-500 mb-2" size={24} />
                <h3 className="font-semibold text-white">Customer Mode</h3>
                <p className="text-gray-400 text-sm">Start a game session</p>
              </button>
            )}
            
            {isShopAdmin && (
              <button
                onClick={() => setActiveTab('items')}
                className="card hover:border-gold-500 transition-all text-left"
              >
                <Package className="text-gold-500 mb-2" size={24} />
                <h3 className="font-semibold text-white">Manage Items</h3>
                <p className="text-gray-400 text-sm">Update prizes & values</p>
              </button>
            )}
            
            {isShopAdmin && (
              <button
                onClick={handleOpenNominationItemsEditor}
                className="card hover:border-gold-500 transition-all text-left"
              >
                <Gift className="text-gold-500 mb-2" size={24} />
                <h3 className="font-semibold text-white">Manage Nominations</h3>
                <p className="text-gray-400 text-sm">Edit customer nomination items</p>
              </button>
            )}
              
              {(permissions.canManageAllShops || permissions.canManageAssignedShops) && (
                <button
                  onClick={handleBackup}
                  className="card hover:border-gold-500 transition-all text-left"
                >
                  <Settings className="text-gold-500 mb-2" size={24} />
                  <h3 className="font-semibold text-white">Backup Data</h3>
                  <p className="text-gray-400 text-sm">Export all data</p>
                </button>
              )}

              {/* Test Mode Toggle - Super Admin Only */}
              {admin?.level === 'super_admin' && (
                <button
                  onClick={async () => {
                    if (isTestMode) {
                      // Turning OFF - clear test data
                      if (confirm('Turn off Test Mode? This will clear all test game attempts.')) {
                        await localAttempts.deleteTestAttempts();
                        clearTestData();
                      }
                    } else {
                      // Turning ON
                      if (confirm('Enable Test Mode? Test data will be isolated from real analytics.')) {
                        const testPrefix = `TEST-${Date.now().toString(36).toUpperCase()}`;
                        setTestMode(true, testPrefix);
                      }
                    }
                  }}
                  className={`card hover:border-gold-500 transition-all text-left ${isTestMode ? 'border-red-500' : ''}`}
                >
                  <FlaskConical className={`mb-2 ${isTestMode ? 'text-red-500' : 'text-gold-500'}`} size={24} />
                  <h3 className="font-semibold text-white">
                    {isTestMode ? '🔴 Test Mode ON' : 'Test Mode'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {isTestMode ? 'Tap to disable & clear data' : 'For Super Admin testing only'}
                  </p>
                </button>
              )}
            </div>

            {/* Top Customer Nominations Section - Only for shop_admin */}
            {currentShop && admin?.level === 'shop_admin' && (
              <div className="mt-8">
                <h2 className="gold-gradient-text text-2xl font-bold mb-4">Top Customer Nominations</h2>
                <div className="card">
                  {nominationsLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500 mx-auto"></div>
                      <p className="text-gray-400 mt-2">Loading nominations...</p>
                    </div>
                  ) : topNominations.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No customer nominations yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topNominations.map((item, index) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gold-500 font-bold text-lg w-6">#{index + 1}</span>
                            <span className="text-white font-medium">{item.name}</span>
                            {item.imageUrl && (
                              <img 
                                src={item.imageUrl} 
                                alt={item.name} 
                                className="w-8 h-8 rounded object-cover"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-sm">{item.nominationCount}</span>
                            <span className="text-gold-500 text-sm">nominations</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Nomination Items Editor Modal */}
            {isEditingNominationItems && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                  <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="gold-gradient-text text-xl font-bold">Manage Nomination Items</h2>
                    <button
                      onClick={() => setIsEditingNominationItems(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto max-h-[70vh]">
                    {nominationItemsLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500 mx-auto"></div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4">
                          <button
                            onClick={() => {
                              setEditingNominationItem({
                                id: `${currentShop?.id}-nom-${Date.now()}`,
                                name: '',
                                value: 0,
                                nominationCount: 0,
                                isActive: true,
                                shopId: currentShop?.id || '',
                                createdAt: new Date(),
                                updatedAt: new Date()
                              });
                              setIsCreatingNominationItem(true);
                            }}
                            className="btn-gold flex items-center gap-2"
                          >
                            <Plus size={18} /> Add New Item
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {nominationItems.map((item) => (
                            <div 
                              key={item.id} 
                              className={`flex items-center justify-between p-3 rounded-lg ${item.isActive ? 'bg-gray-800/50' : 'bg-gray-800/20 opacity-50'}`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex-1">
                                  <p className="text-white font-medium">{item.name || '(No name)'}</p>
                                  <p className="text-gray-400 text-sm">Value: {item.value.toLocaleString()} | Nominations: {item.nominationCount}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleNominationItemActive(item)}
                                  className={`px-3 py-1 rounded text-sm ${item.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}
                                >
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNominationItem(item);
                                    setIsCreatingNominationItem(false);
                                  }}
                                  className="p-2 text-blue-400 hover:text-blue-300"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteNominationItem(item.id)}
                                  className="p-2 text-red-400 hover:text-red-300"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Edit/Create Nomination Item Modal */}
            {editingNominationItem && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-900 rounded-lg max-w-md w-full">
                  <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="gold-gradient-text text-xl font-bold">
                      {isCreatingNominationItem ? 'Add Nomination Item' : 'Edit Nomination Item'}
                    </h2>
                    <button
                      onClick={() => {
                        setEditingNominationItem(null);
                        setIsCreatingNominationItem(false);
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                      const value = parseFloat((form.elements.namedItem('value') as HTMLInputElement).value) || 0;
                      const imageUrl = (form.elements.namedItem('imageUrl') as HTMLInputElement).value;
                      
                      handleSaveNominationItem({
                        ...editingNominationItem,
                        name,
                        value,
                        imageUrl: imageUrl || undefined,
                        updatedAt: new Date()
                      });
                    }}
                    className="p-4 space-y-4"
                  >
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Item Name</label>
                      <input
                        name="name"
                        defaultValue={editingNominationItem.name}
                        className="input w-full"
                        placeholder="Enter item name"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Value / Price</label>
                      <input
                        name="value"
                        type="number"
                        defaultValue={editingNominationItem.value}
                        className="input w-full"
                        placeholder="Enter value"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Image URL (optional)</label>
                      <input
                        name="imageUrl"
                        type="url"
                        defaultValue={editingNominationItem.imageUrl || ''}
                        className="input w-full"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <button type="submit" className="btn-gold flex-1">
                        <Save size={18} className="inline mr-2" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNominationItem(null);
                          setIsCreatingNominationItem(false);
                        }}
                        className="btn-gray flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // My Shop view - for shop admins to edit their shop's qualifying purchase
  if (activeTab === 'myShop') {
    // Get shops assigned to this admin based on their level
    // Shop admins can only see their assigned shops
    const assignedShopIds = admin?.assignedShops || [];
    const isShopAdmin = admin?.level === 'shop_admin';
    
    // For shop admins, only show their ONE permanently assigned shop
    // They cannot switch shops - it's permanent based on device
    // For super/agent admins, show all shops (or assigned if specified)
    const availableShops = isShopAdmin 
      ? shops.filter(s => assignedShopIds.includes(s.id)).slice(0, 1) // Only first shop for shop_admin
      : assignedShopIds.length > 0 
        ? shops.filter(s => assignedShopIds.includes(s.id))
        : shops;
    
    // For shop_admin, if no currentShop is set but they have one assigned, auto-select it
    const effectiveShop = currentShop || (isShopAdmin && availableShops.length === 1 ? availableShops[0] : null);
    
    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">My Shop</h1>
            
            {!effectiveShop ? (
              <div className="card">
                {isShopAdmin ? (
                  <p className="text-gray-500">No shop assigned to your device. Contact your administrator.</p>
                ) : (
                  <>
                    <h3 className="font-semibold text-white mb-4">Select Your Shop</h3>
                    {availableShops.length === 0 ? (
                      <p className="text-gray-500">No shops assigned to your account.</p>
                    ) : (
                      <div className="space-y-3">
                        {availableShops.map((shop) => (
                          <button
                            key={shop.id}
                            onClick={() => {
                              setCurrentShop(shop);
                              loadItems();
                              loadAttempts();
                            }}
                            className="w-full card hover:border-gold-500 text-left"
                          >
                            <h4 className="font-semibold text-white">{shop.shopName}</h4>
                            <p className="text-gray-400 text-sm">Code: {shop.shopCode}</p>
                            <p className="text-gray-500 text-xs">
                              Qualifying: KSh {shop.qualifyingPurchase.toLocaleString()}
                            </p>
                            {shop.addedByName && (
                              <p className="text-blue-400 text-xs mt-1">
                                Added by agent_admin: {shop.addedByName}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="card mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white text-lg">{effectiveShop.shopName}</h3>
                      <p className="text-gray-400 text-sm">Code: {effectiveShop.shopCode}</p>
                    </div>
                    {/* Hide the X button for shop_admin - they cannot switch shops */}
                    {!isShopAdmin && (
                      <button
                        onClick={() => setCurrentShop(null)}
                        className="text-gray-400 hover:text-white"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                  
                  {(canEditQualifyingPurchase) && (
                    <div className="mb-6 p-4 bg-gold-900/20 border-2 border-gold-500 rounded-lg">
                      <label className="block text-white font-semibold text-lg mb-2 flex items-center gap-2">
                        <Edit size={20} className="text-gold-400" />
                        Edit Qualifying Purchase Amount
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-lg">KSh</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={qpInput}
                          onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                          onChange={(e) => setQpInput(e.target.value)}
                          className="input w-full max-w-xs text-xl font-bold border-2 border-gold-500 focus:border-gold-400"
                          min={0}
                        />
                        <button
                          onClick={async () => {
                            if (!currentShop || qpSaving) return;
                            setQpSaving(true);
                            try {
                              const newValue = Number(qpInput) || 0;
                              const updatedShop = { ...currentShop, qualifyingPurchase: newValue };
                              
                              // Save using sync service (handles offline)
                              await saveShopWithSync(updatedShop, false);
                              
                              // Update state
                              setCurrentShop(updatedShop);
                              setShops(prev => prev.map(s => s.id === updatedShop.id ? updatedShop : s));
                              localStorage.setItem('metofun-current-shop', JSON.stringify(updatedShop));
                              loadAttempts();
                              
                              alert('Qualifying purchase updated successfully!');
                            } catch (err) {
                              console.error('Error saving qualifying purchase:', err);
                              alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
                            } finally {
                              setQpSaving(false);
                            }
                          }}
                          disabled={qpSaving}
                          className="btn-gold px-4 py-2"
                        >
                          {qpSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      <p className="text-gray-500 text-sm mt-2">
                        💡 Minimum purchase amount required to play the game
                      </p>
                    </div>
                  )}

                  {(!canEditQualifyingPurchase) && currentShop && (
                    <div className="mb-4">
                      <label className="block text-gray-400 text-sm mb-2">
                        Qualifying Purchase Amount (KSh)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={currentShop.qualifyingPurchase}
                        disabled
                        className="input w-full bg-gray-800 cursor-not-allowed opacity-60"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Read-only • Contact your administrator to change this value
                      </p>
                    </div>
                  )}
                </div>
                
                {permissions.canEditItems && (
                  <div className="card">
                    <h3 className="font-semibold text-white mb-4">Quick Edit Items</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Go to the Items tab to edit prize values. 
                      Item values must be ≤ 60% of qualifying purchase (KSh {(effectiveShop?.qualifyingPurchase * 0.6).toLocaleString()})
                    </p>
                    <button
                      onClick={() => setActiveTab('items')}
                      className="btn-gold"
                    >
                      <Package size={18} className="mr-2" />
                      Manage Items
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Customers view - for shop staff to record purchases and authorize customers
  if (activeTab === 'customers') {
    const handleAddCustomer = async () => {
      if (!newCustomer.phoneNumber || !newCustomer.purchaseAmount || !newCustomer.itemId) {
        alert('Please fill in all fields');
        return;
      }
      const amount = parseFloat(newCustomer.purchaseAmount);
      if (isNaN(amount) || amount < (currentShop?.qualifyingPurchase || 0)) {
        alert(`Minimum purchase is KSh ${currentShop?.qualifyingPurchase || 0}`);
        return;
      }
      const selectedItem = itemsList.find(i => i.id === newCustomer.itemId);
      const customer: PendingCustomer = {
        id: crypto.randomUUID(),
        phoneNumber: newCustomer.phoneNumber,
        shopId: currentShop!.id,
        purchaseAmount: amount,
        qualifyingAmount: currentShop!.qualifyingPurchase,
        itemId: newCustomer.itemId,
        itemName: selectedItem?.name || '',
        recordedBy: admin?.id || '',
        recordedAt: new Date(),
        authorized: false,
        used: false
      };
      await localPendingCustomers.save(customer);
      setPendingCustomers(await localPendingCustomers.getByShop(currentShop!.id));
      setShowAddForm(false);
      setNewCustomer({ phoneNumber: '', purchaseAmount: '', itemId: '' });
    };

    const handleAuthorize = async (id: string) => {
      await localPendingCustomers.authorize(id, admin?.id || '');
      setPendingCustomers(await localPendingCustomers.getByShop(currentShop!.id));
    };

    const handleLaunchCustomer = async (customer: PendingCustomer, isDemo: boolean = false, customQualifyingPurchase?: number) => {
      // For non-shop admins, force demo mode
      const isDemoMode = isDemo || admin?.level !== 'shop_admin';
      
      // Set demo mode in game store
      setDemoMode(isDemoMode);
      
      // Get the item for this customer
      const item = itemsList.find(i => i.id === customer.itemId);
      
      // Use custom qualifying purchase for demo mode, otherwise use shop's value
      const qualifyingPurchase = isDemoMode && customQualifyingPurchase 
        ? customQualifyingPurchase 
        : (currentShop?.qualifyingPurchase || 0);
      
      // Calculate box configuration based on purchase amount
      const config = calculateBoxConfiguration(customer.purchaseAmount, qualifyingPurchase);
      
      // Generate winning number from the displayed range (1 to 18-threshold)
      const winningNum = generateSecureRandomNumber(18 - config.threshold);
      const threshold = config.threshold;
      
      // Set up the customer session
      setCustomerSession({
        phoneNumber: customer.phoneNumber,
        attemptsToday: 0,
        lastAttemptDate: new Date().toISOString().split('T')[0],
        authorized: true,
        purchaseAmount: customer.purchaseAmount
      });
      
      // Set the selected item and game parameters
      if (item) {
        setSelectedItem(item);
      }
      setCorrectNumber(winningNum);
      setThresholdNumber(threshold);
      
      // Set game to playing state
      setGameStatus('playing');
      
      // Only mark customer as used in real mode (not demo)
      if (!isDemoMode) {
        await localPendingCustomers.markUsed(customer.id);
        setPendingCustomers(await localPendingCustomers.getByShop(currentShop!.id));
      }
      
      // Switch to customer view
      setCurrentView('customer');
    };

    const handleDelete = async (id: string) => {
      if (confirm('Remove this customer record?')) {
        await localPendingCustomers.delete(id);
        setPendingCustomers(await localPendingCustomers.getByShop(currentShop!.id));
      }
    };

    const authorized = pendingCustomers.filter(c => c.authorized && !c.used);
    const pending = pendingCustomers.filter(c => !c.authorized);

    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="gold-gradient-text text-3xl font-bold">Customers</h1>
              <button 
                onClick={() => setShowAddForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <UserPlus size={20} /> Record Purchase
              </button>
            </div>

            {/* Demo Mode Qualifying Purchase Setting - Only for shop admins */}
            {isShopAdmin && (
              <div className="card p-4 mb-6 bg-yellow-900/20 border-yellow-500/30">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Zap className="text-yellow-400" size={20} />
                    <span className="text-yellow-400 font-medium">Demo Mode Qualifying Purchase:</span>
                  </div>
                  <input
                    type="number"
                    value={demoQualifyingPurchase}
                    onChange={(e) => setDemoQualifyingPurchase(Number(e.target.value) || 0)}
                    onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                    className="input-field w-32"
                    min="0"
                  />
                  <span className="text-gray-400 text-sm">
                    (Used when clicking &quot;Demo&quot; button - doesn&apos;t affect real shop settings)
                  </span>
                </div>
              </div>
            )}

            {!currentShop ? (
              <div className="card p-8 text-center">
                <p className="text-gray-400">Please select a shop from &quot;My Shop&quot; first.</p>
              </div>
            ) : (
              <>
                {/* Add Customer Form Modal */}
                {showAddForm && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card p-6 max-w-md w-full mx-4">
                      <h2 className="text-xl font-bold text-white mb-4">Record Customer Purchase</h2>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-400 text-sm mb-1">Phone Number</label>
                          <input
                            type="tel"
                            value={newCustomer.phoneNumber}
                            onChange={(e) => setNewCustomer({...newCustomer, phoneNumber: e.target.value})}
                            placeholder="0712345678"
                            className="input-field w-full"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-400 text-sm mb-1">
                            Purchase Amount (Min: KSh {currentShop.qualifyingPurchase})
                          </label>
                          <input
                            type="number"
                            value={newCustomer.purchaseAmount}
                            onChange={(e) => setNewCustomer({...newCustomer, purchaseAmount: e.target.value})}
                            placeholder="Enter amount"
                            className="input-field w-full"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-400 text-sm mb-1">Item to Win</label>
                          <select
                            value={newCustomer.itemId}
                            onChange={(e) => setNewCustomer({...newCustomer, itemId: e.target.value})}
                            className="input-field w-full"
                          >
                            <option value="">Select item</option>
                            {itemsList.filter(i => i.isActive).map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} - KSh {item.value.toLocaleString()}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                          <button onClick={handleAddCustomer} className="btn-primary flex-1">
                            Save
                          </button>
                          <button 
                            onClick={() => { setShowAddForm(false); setNewCustomer({ phoneNumber: '', purchaseAmount: '', itemId: '' }); }}
                            className="btn-secondary flex-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Authorized Customers */}
                {authorized.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
                      <UserCheck size={20} /> Ready to Play ({authorized.length})
                    </h2>
                    <div className="space-y-2">
                      {authorized.map(c => (
                        <div key={c.id} className="card p-4 flex justify-between items-center border-green-500/30">
                          <div className="flex-1">
                            <p className="text-white font-medium">{c.phoneNumber}</p>
                            <p className="text-gray-400 text-sm">
                              {c.itemName} - KSh {c.purchaseAmount.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {admin?.level !== 'shop_admin' && (
                              <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded flex items-center gap-1">
                                <Zap size={12} /> Demo
                              </span>
                            )}
                            <button 
                              onClick={() => handleLaunchCustomer(c, true, demoQualifyingPurchase)}
                              className="btn-secondary flex items-center gap-1"
                            >
                              <Zap size={16} /> Demo
                            </button>
                            <button 
                              onClick={() => handleLaunchCustomer(c)}
                              className="btn-primary flex items-center gap-1"
                            >
                              <Smartphone size={16} /> Play
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Authorization */}
                <div>
                  <h2 className="text-xl font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                    <UserPlus size={20} /> Waiting for Authorization ({pending.length})
                  </h2>
                  {pending.length === 0 ? (
                    <div className="card p-8 text-center text-gray-500">
                      No customers waiting. Click &quot;Record Purchase&quot; to add one.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pending.map(c => (
                        <div key={c.id} className="card p-4 flex justify-between items-center">
                          <div>
                            <p className="text-white font-medium">{c.phoneNumber}</p>
                            <p className="text-gray-400 text-sm">
                              {c.itemName} - KSh {c.purchaseAmount.toLocaleString()}
                            </p>
                            <p className="text-gray-500 text-xs">
                              Recorded: {new Date(c.recordedAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleAuthorize(c.id)}
                              className="btn-primary flex items-center gap-1"
                            >
                              <UserCheck size={16} /> Authorize
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Shops view
  if (activeTab === 'shops') {
    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="gold-gradient-text text-3xl font-bold">Shops</h1>
              {(permissions.canManageAllShops || permissions.canManageAssignedShops) && (
                <button
                  onClick={() => {
                    setIsCreatingShop(true);
                    setUserActive(true);
                  }}
                  className="btn-gold flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add Shop
                </button>
              )}
            </div>

            <AnimatePresence>
              {(isCreatingShop || editingShop) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card-gold mb-6"
                >
                  <h3 className="font-semibold mb-4">
                    {isCreatingShop ? 'Create New Shop' : 'Edit Shop'}
                  </h3>
                  <ShopForm
                    shop={editingShop}
                    onSave={handleSaveShop}
                    onCancel={() => {
                      setIsCreatingShop(false);
                      setEditingShop(null);
                      setUserActive(false);
                    }}
                    isShopAdmin={isShopAdmin}
                    adminInfo={admin ? { id: admin.id, name: admin.name, level: admin.level } : null}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {shops.length === 0 ? (
                <div className="text-center py-12">
                  <Store size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-500">No shops yet</p>
                </div>
              ) : (
                shops.map((shop) => (
                  <div key={shop.id} className="card flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{shop.shopName}</h3>
                      <p className="text-gray-400 text-sm">Code: {shop.shopCode}</p>
                      <p className="text-gray-500 text-xs">
                        Qualifying: KSh {shop.qualifyingPurchase.toLocaleString()}
                      </p>
                      {shop.addedByName && (
                        <p className="text-blue-400 text-xs mt-1">
                          Added by agent_admin: {shop.addedByName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          shop.isActive 
                            ? 'bg-green-900/50 text-green-400' 
                            : 'bg-red-900/50 text-red-400'
                        }`}>
                          {shop.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {shop.deviceLocked && (
                          <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs">
                            <Smartphone size={12} className="inline mr-1" />
                            Device Locked
                          </span>
                        )}
                        {/* Subscription Tier Badge - only show for admin */}
                        {admin?.level === 'super_admin' && (
                          <select
                            value={shop.subscriptionTier || 'basic'}
                            onChange={(e) => handleUpdateSubscription(shop.id, e.target.value as 'basic' | 'medium' | 'pro')}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              shop.subscriptionTier === 'pro' 
                                ? 'bg-purple-900/50 text-purple-400' 
                                : shop.subscriptionTier === 'medium'
                                ? 'bg-blue-900/50 text-blue-400'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            <option value="basic">Basic</option>
                            <option value="medium">Medium</option>
                            <option value="pro">Pro</option>
                          </select>
                        )}
                        {admin?.level !== 'super_admin' && shop.subscriptionTier && (
                          <span className={`px-2 py-1 rounded text-xs ${
                            shop.subscriptionTier === 'pro' 
                              ? 'bg-purple-900/50 text-purple-400' 
                              : shop.subscriptionTier === 'medium'
                              ? 'bg-blue-900/50 text-blue-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}>
                            {shop.subscriptionTier.charAt(0).toUpperCase() + shop.subscriptionTier.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCurrentShop(shop);
                          loadItems();
                          loadAttempts();
                        }}
                        className="p-2 text-gold-500 hover:bg-gold-900/30 rounded"
                        title="Manage Items"
                      >
                        <Package size={20} />
                      </button>
                      {(permissions.canManageAllShops || permissions.canManageAssignedShops) && (
                        <button
                          onClick={() => handleToggleShopActive(shop)}
                          className={`p-2 rounded ${
                            shop.isActive 
                              ? 'text-red-500 hover:bg-red-900/30' 
                              : 'text-green-500 hover:bg-green-900/30'
                          }`}
                          title={shop.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {shop.isActive ? <PowerOff size={20} /> : <Power size={20} />}
                        </button>
                      )}
                      {(permissions.canManageAllShops || permissions.canManageAssignedShops) && (
                        <>
                          <button
                            onClick={() => {
                              setEditingShop(shop);
                              setUserActive(true);
                            }}
                            className="p-2 text-blue-500 hover:bg-blue-900/30 rounded"
                          >
                            <Edit size={20} />
                          </button>
                        </>
                      )}
                      {/* Delete button - only for admin */}
                      {admin?.level === 'super_admin' && (
                        <button
                          onClick={() => handleDeleteShop(shop.id)}
                          className="p-2 text-red-500 hover:bg-red-900/30 rounded"
                          title="Delete Shop (Super Admin Only)"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Items view
  if (activeTab === 'items') {
    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">
              Items - {currentShop?.shopName || 'No Shop Selected'}
            </h1>

            {currentShop ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {items.map((item) => (
                    <div key={item.id} className="card">
                      {/* Item Image */}
                      <div className="h-32 bg-gray-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={48} className="text-gray-600" />
                        )}
                      </div>
                      
                      {/* Item Name */}
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-white">{item.name}</h3>
                        {permissions.canEditItems && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setUserActive(true);
                              }}
                              className="p-1 text-blue-500 hover:bg-blue-900/30 rounded"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-red-500 hover:bg-red-900/30 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Item Price */}
                      <p className="text-gold-400 font-bold text-lg">
                        KSh {item.value.toLocaleString()}
                      </p>
                      
                      {/* Status & Stock */}
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.isActive ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                        }`}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.stockStatus}
                        </span>
                      </div>
                      
                      {/* Price Validation */}
                      {currentShop && (
                        <div className={`mt-2 text-xs ${
                          validateItemPrice(item.value, currentShop.qualifyingPurchase)
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}>
                          {validateItemPrice(item.value, currentShop.qualifyingPurchase)
                            ? '✓ Within 60% limit'
                            : '⚠ Exceeds 60% limit'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {editingItem && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="card-gold"
                    >
                      <h3 className="font-semibold mb-4">Edit Item</h3>
                      <ItemForm
                        item={editingItem}
                        qualifyingPurchase={currentShop.qualifyingPurchase}
                        onSave={handleSaveItem}
                        onCancel={() => {
                          setEditingItem(null);
                          setUserActive(false);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="text-center py-12">
                <Package size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-500">Select a shop to manage items</p>
                <button
                  onClick={() => setActiveTab('shops')}
                  className="btn-gold-outline mt-4"
                >
                  Go to Shops
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Qualifying Purchase view - for shop admins to edit qualifying purchase amount
  if (activeTab === 'qualifyingPurchase') {
    if (!currentShop) {
      return (
        <div className="min-h-screen flex">
          <AdminSidebar 
            tabs={tabs} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            onLogout={handleLogout}
            admin={admin}
          />
          
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-2xl mx-auto text-center py-12">
              <Zap size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500">Select a shop to manage qualifying purchase amount</p>
              <button
                onClick={() => setActiveTab('shops')}
                className="btn-gold-outline mt-4"
              >
                Go to Shops
              </button>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-2">
              Qualifying Purchase
            </h1>
            <p className="text-gray-400 mb-6">
              Set the minimum purchase amount required to play the game
            </p>
            
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white text-lg">{currentShop.shopName}</h3>
                  <p className="text-gray-400 text-sm">Code: {currentShop.shopCode}</p>
                </div>
              </div>
              
              {(canEditQualifyingPurchase) && (
                <div className="p-4 bg-gold-900/20 border-2 border-gold-500 rounded-lg">
                  <label className="block text-white font-semibold text-lg mb-2 flex items-center gap-2">
                    <Zap size={20} className="text-gold-400" />
                    Minimum Purchase Amount
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-lg">KSh</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={qpInput}
                      onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                      onChange={(e) => setQpInput(e.target.value)}
                      className="input w-full max-w-xs text-xl font-bold border-2 border-gold-500 focus:border-gold-400"
                      min={0}
                    />
                    <button
                      onClick={async () => {
                        if (!currentShop || qpSaving) return;
                        setQpSaving(true);
                        try {
                          const newValue = Number(qpInput) || 0;
                          const updatedShop = { ...currentShop, qualifyingPurchase: newValue };
                          
                          // Save using sync service (handles offline)
                          await saveShopWithSync(updatedShop, false);
                          
                          // Update state
                          setCurrentShop(updatedShop);
                          setShops(prev => prev.map(s => s.id === updatedShop.id ? updatedShop : s));
                          localStorage.setItem('metofun-current-shop', JSON.stringify(updatedShop));
                          loadAttempts();
                          
                          alert('Qualifying purchase updated successfully!');
                        } catch (err) {
                          console.error('Error saving qualifying purchase:', err);
                          alert('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
                        } finally {
                          setQpSaving(false);
                        }
                      }}
                      disabled={qpSaving}
                      className="btn-gold px-4 py-2"
                    >
                      {qpSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <p className="text-gray-500 text-sm mt-2">
                    💡 Minimum purchase amount required to play the game
                  </p>
                </div>
              )}

              {(!canEditQualifyingPurchase) && currentShop && (
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">
                    Qualifying Purchase Amount (KSh)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentShop.qualifyingPurchase}
                    disabled
                    className="input w-full bg-gray-800 cursor-not-allowed opacity-60"
                  />
                  <p className="text-gray-500 text-sm mt-2">
                    You do not have permission to edit this value
                  </p>
                </div>
              )}
            </div>
            
            <div className="card">
              <h3 className="font-semibold text-white mb-3">Important Notes</h3>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Item values must be ≤ 60% of qualifying purchase</li>
                <li>• Current limit: KSh {(currentShop.qualifyingPurchase * 0.6).toLocaleString()} per item</li>
                <li>• Go to Items tab to edit prize values</li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Attempts view
  if (activeTab === 'attempts') {
    // For super_admin/agent_admin, group attempts by shop
    const isSuperOrAgent = admin?.level === 'super_admin' || admin?.level === 'agent_admin';
    
    let attemptsByShop: { [shopId: string]: typeof attempts } = {};
    let shopNames: { [shopId: string]: string } = {};
    
    if (isSuperOrAgent && attempts.length > 0) {
      // Group attempts by shopId
      attempts.forEach((attempt) => {
        const shopId = attempt.shopId || 'unknown';
        if (!attemptsByShop[shopId]) {
          attemptsByShop[shopId] = [];
        }
        attemptsByShop[shopId].push(attempt);
      });
      
      // Get shop names
      shops.forEach((shop) => {
        shopNames[shop.id] = shop.shopName;
      });
    }

    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Game Attempts</h1>
            
            {isSuperOrAgent ? (
              // Super admin/agent admin: show all attempts grouped by shop
              <div className="space-y-6">
                {Object.keys(attemptsByShop).length === 0 ? (
                  <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">No attempts yet</p>
                  </div>
                ) : (
                  Object.entries(attemptsByShop).map(([shopId, shopAttempts]) => (
                    <div key={shopId}>
                      <button
                        onClick={() => toggleShopExpanded(shopId)}
                        className="w-full text-left mb-2"
                      >
                        <h2 className="text-xl font-semibold text-gold-400 flex items-center gap-2 hover:text-gold-300 transition-colors">
                          <Store size={20} />
                          {shopNames[shopId] || 'Unknown Shop'}
                          <span className="text-gray-500 text-sm">({shopAttempts.length} attempts)</span>
                          <span className="ml-auto text-gray-500">
                            {expandedShops.has(shopId) ? '▼' : '▶'}
                          </span>
                        </h2>
                      </button>
                      <AnimatePresence>
                        {expandedShops.has(shopId) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-3 overflow-hidden"
                          >
                            {shopAttempts.map((attempt) => (
                              <div key={attempt.id} className="card flex items-center justify-between">
                                <div>
                                  <p className="text-white font-medium">{attempt.phoneNumber}</p>
                                  <p className="text-gray-400 text-sm">
                                    Purchase: KSh {attempt.purchaseAmount.toLocaleString()} | 
                                    Selected: {attempt.selectedItem?.name || `Box ${attempt.selectedBox}`}
                                  </p>
                                  <p className="text-gray-500 text-xs">
                                    {new Date(attempt.timestamp).toLocaleString()}
                                  </p>
                                </div>
                                <div className={`px-3 py-1 rounded ${
                                  attempt.won 
                                    ? 'bg-green-900/50 text-green-400' 
                                    : 'bg-red-900/50 text-red-400'
                                }`}>
                                  {attempt.won ? 'WIN' : 'LOSE'}
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            ) : currentShop ? (
              // Shop admin: show attempts for their shop only
              <div className="space-y-3">
                {attempts.length === 0 ? (
                  <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-500">No attempts yet</p>
                  </div>
                ) : (
                  attempts.map((attempt) => (
                    <div key={attempt.id} className="card flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{attempt.phoneNumber}</p>
                        <p className="text-gray-400 text-sm">
                          Purchase: KSh {attempt.purchaseAmount.toLocaleString()} | 
                          Selected: {attempt.selectedItem?.name || `Box ${attempt.selectedBox}`}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(attempt.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded ${
                        attempt.won 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-red-900/50 text-red-400'
                      }`}>
                        {attempt.won ? 'WIN' : 'LOSE'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-500">Select a shop to view attempts</p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Analytics view
  if (activeTab === 'analytics') {
    const analytics = attempts.length > 0 ? calculateShopAnalytics(attempts, currentShop?.id || '') : null;
    
    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Analytics</h1>
            
            {analytics && currentShop ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card text-center">
                    <p className="text-gray-400 text-sm">Total Attempts</p>
                    <p className="text-4xl font-bold text-gold-400">{analytics.totalAttempts}</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-gray-400 text-sm">Total Wins</p>
                    <p className="text-4xl font-bold text-green-400">{analytics.totalWins}</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-gray-400 text-sm">Win Rate</p>
                    <p className="text-4xl font-bold text-blue-400">{analytics.winRate.toFixed(1)}%</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-gray-400 text-sm">Tampered</p>
                    <p className="text-4xl font-bold text-red-400">{analytics.tamperedCount || 0}</p>
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-semibold mb-4">Most Selected Items</h3>
                  <div className="space-y-2">
                    {analytics.mostSelectedItems.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-gray-300">Item {item.itemId}</span>
                        <span className="text-gold-400">{item.count} times</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Staff management view (Super Admin and Agent Admin with assign shops permission)
  if (activeTab === 'staff') {
    const handleAddStaff = () => {
      setEditingAdmin({
        id: crypto.randomUUID(),
        email: '',
        phone: '',
        name: '',
        level: 'shop_admin',
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true,
        assignedShops: [],
        region: ''
      });
      setIsCreatingAdmin(true);
    };

    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Staff Management</h1>
            
            <AnimatePresence>
              {(isCreatingAdmin || editingAdmin) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card-gold mb-6"
                >
                  <h3 className="font-semibold mb-4">
                    {isCreatingAdmin ? 'Add New Staff' : 'Edit Staff'}
                  </h3>
                  <AdminForm
                    admin={editingAdmin}
                    shops={shops}
                    admins={admins}
                    onSave={handleSaveAdmin}
                    onCancel={() => {
                      setIsCreatingAdmin(false);
                      setEditingAdmin(null);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Staff List</h3>
                <button
                  onClick={handleAddStaff}
                  className="btn-gold flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Staff
                </button>
              </div>
              <div className="space-y-3">
                {admins.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No staff members yet</p>
                ) : (
                  admins.map((staff) => (
                    <div key={staff.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
                      <div>
                        <p className="text-white font-medium">{staff.name || 'Unnamed'}</p>
                        <p className="text-gray-400 text-sm">{staff.email}</p>
                        <p className="text-gray-500 text-xs">{staff.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded text-sm ${
                          staff.level === 'super_admin' 
                            ? 'bg-gold-900/50 text-gold-400' 
                            : 'bg-green-900/50 text-green-400'
                        }`}>
                          {staff.level === 'super_admin' ? 'Admin' : 'Shop Admin'}
                        </span>
                        {staff.id !== admin?.id && (
                          <>
                            <button
                              onClick={() => setEditingAdmin(staff)}
                              className="p-2 text-blue-500 hover:bg-blue-900/30 rounded"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteAdmin(staff.id)}
                              className="p-2 text-red-500 hover:bg-red-900/30 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Settings view
  if (activeTab === 'settings') {
    return (
      <div className="min-h-screen flex">
        <AdminSidebar 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onLogout={handleLogout}
          admin={admin}
        />
        
        <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-2xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Settings</h1>
            
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Device Lock</h3>
                    <p className="text-gray-400 text-sm">Lock this shop to this device</p>
                  </div>
                  <button onClick={handleLockDevice} className="btn-gold-outline">
                    <Smartphone size={16} className="mr-2" />
                    {currentShop?.deviceLocked ? 'Locked' : 'Lock Device'}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Backup Data</h3>
                    <p className="text-gray-400 text-sm">Export all shop data</p>
                  </div>
                  <button onClick={handleBackup} className="btn-gold-outline">
                    <Settings size={16} className="mr-2" />
                    Backup
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Restore Data</h3>
                    <p className="text-gray-400 text-sm">Import data from backup</p>
                  </div>
                  <button className="btn-gold-outline">
                    <Settings size={16} className="mr-2" />
                    Restore
                  </button>
                </div>
              </div>

              {/* Change Dashboard PIN */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-white">Change Dashboard PIN</h3>
                    <p className="text-gray-400 text-sm">Change your 4-digit dashboard access PIN</p>
                  </div>
                  <button 
                    onClick={() => setIsChangingPassword(!isChangingPassword)}
                    className="btn-gold-outline"
                  >
                    <Lock size={16} className="mr-2" />
                    {isChangingPassword ? 'Cancel' : 'Change PIN'}
                  </button>
                </div>
                
                {isChangingPassword && (
                  <div className="space-y-3 mt-4 pt-4 border-t border-gray-700">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Current PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="input"
                        placeholder="Enter current PIN"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">New PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="input"
                        placeholder="Enter new PIN"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Confirm New PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="input"
                        placeholder="Confirm new PIN"
                      />
                    </div>
                    <button onClick={handlePasswordChange} className="btn-gold w-full">
                      Update PIN
                    </button>
                  </div>
                )}
              </div>

              {/* Terms and Conditions - Admin Only */}
              {admin?.level === 'super_admin' && (
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white">Terms & Conditions</h3>
                      <p className="text-gray-400 text-sm">Manage platform terms and conditions</p>
                    </div>
                    {!isEditingTerms ? (
                      <button 
                        onClick={() => setIsEditingTerms(true)}
                        className="btn-gold-outline"
                      >
                        <Edit size={16} className="mr-2" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setIsEditingTerms(false);
                            firebaseSettings.getSettings().then(s => setTermsContent(s.termsContent));
                          }}
                          className="btn-gold-outline text-gray-400"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveTerms}
                          className="btn-gold"
                        >
                          <Save size={16} className="mr-2" />
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {termsSaved && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm">
                      ✓ Terms & Conditions saved successfully!
                    </div>
                  )}
                  
                  {isEditingTerms ? (
                    <textarea
                      value={termsContent}
                      onChange={(e) => setTermsContent(e.target.value)}
                      className="w-full h-64 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white text-sm resize-none focus:border-amber-500 focus:outline-none"
                      placeholder="Enter terms and conditions content..."
                    />
                  ) : (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 text-sm max-h-64 overflow-y-auto">
                      {termsContent || 'No terms and conditions defined. Click Edit to add content.'}
                    </div>
                  )}
                </div>
              )}

              {/* View Terms & Conditions - All Admins */}
              {admin?.level !== 'super_admin' && (
                <div className="card">
                  <h3 className="font-semibold text-white mb-4">Terms & Conditions</h3>
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-300 text-sm max-h-64 overflow-y-auto">
                    {termsContent || 'No terms and conditions defined. Contact your administrator.'}
                  </div>
                </div>
              )}

              {/* Item of the Day - Super Admin Only */}
              {admin?.level === 'super_admin' && (
                <div className="card border-amber-900/50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Star className="text-amber-400" size={18} />
                        Item of the Day
                      </h3>
                      <p className="text-gray-400 text-sm">Global marketing banner shown in all shops</p>
                    </div>
                    {!isEditingItemOfDay ? (
                      <div className="flex gap-2">
                        {itemOfTheDay && (
                          <button 
                            onClick={handleEditItemOfDay}
                            className="btn-gold-outline"
                          >
                            <Edit size={16} className="mr-2" />
                            Edit
                          </button>
                        )}
                        <button 
                          onClick={handleEditItemOfDay}
                          className="btn-gold"
                        >
                          <Plus size={16} className="mr-2" />
                          {itemOfTheDay ? 'Change' : 'Add'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setIsEditingItemOfDay(false);
                            if (!itemOfTheDay) {
                              setItemOfDayForm({ name: '', value: '', imageUrl: '' });
                            }
                          }}
                          className="btn-gold-outline text-gray-400"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveItemOfDay}
                          className="btn-gold"
                        >
                          <Save size={16} className="mr-2" />
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {itemOfDaySaved && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm">
                      ✓ Item of the Day saved successfully!
                    </div>
                  )}
                  
                  {isEditingItemOfDay ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Item Name</label>
                        <input
                          type="text"
                          value={itemOfDayForm.name}
                          onChange={(e) => setItemOfDayForm({ ...itemOfDayForm, name: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-amber-500 focus:outline-none"
                          placeholder="e.g., Special Weekend Prize!"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Value (KSh)</label>
                        <input
                          type="number"
                          value={itemOfDayForm.value}
                          onChange={(e) => setItemOfDayForm({ ...itemOfDayForm, value: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-amber-500 focus:outline-none"
                          placeholder="e.g., 50000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Image URL (optional)</label>
                        <input
                          type="url"
                          value={itemOfDayForm.imageUrl}
                          onChange={(e) => setItemOfDayForm({ ...itemOfDayForm, imageUrl: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-amber-500 focus:outline-none"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                    </div>
                  ) : itemOfTheDay ? (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-amber-900/30 rounded-lg flex items-center justify-center">
                          {itemOfTheDay.imageUrl ? (
                            <img src={itemOfTheDay.imageUrl} alt={itemOfTheDay.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Gift className="text-amber-400 w-8 h-8" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-amber-400 font-semibold">{itemOfTheDay.name}</p>
                          <p className="text-white text-lg font-bold">KSh {itemOfTheDay.value.toLocaleString()}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-gray-500 text-xs">
                              Last updated: {new Date(itemOfTheDay.updatedAt).toLocaleDateString()}
                            </span>
                            <span className="text-gray-600">|</span>
                            <span className="flex items-center gap-1 text-amber-400 text-xs">
                              <Heart className="w-3 h-3" />
                              {itemOfTheDay.likes || 0} likes
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={handleClearItemOfDay}
                          className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"
                          title="Remove Item of the Day"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center text-gray-500">
                      <Star className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                      <p>No Item of the Day set</p>
                      <p className="text-xs">Click &quot;Add&quot; to create a featured item</p>
                    </div>
                  )}
                </div>
              )}

              <div className="card border-red-900/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Clear All Data</h3>
                    <p className="text-gray-400 text-sm">Reset the application</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm('Are you sure? This will delete all data!')) {
                        clearAllData();
                      }
                    }}
                    className="btn-gold-outline text-red-400 border-red-400 hover:bg-red-900/30"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

// Sidebar Component
function AdminSidebar({ 
  tabs, 
  activeTab, 
  setActiveTab,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  onLogout,
  admin 
}: { 
  tabs: any[]; 
  activeTab: string; 
  setActiveTab: (tab: TabType) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  onLogout: () => void;
  admin: any;
}) {
  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-dark-surface rounded-lg lg:hidden"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-dark-surface border-r border-dark-border
        transform transition-transform lg:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <div className="mb-8">
            <img 
              src="/metofun-logo.png" 
              alt="ETO FUN" 
              className="w-32 h-auto"
            />
          </div>
          
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setIsMobileMenuOpen(false);
                }}
                className={`nav-item w-full flex items-center gap-3 ${
                  activeTab === tab.id ? 'active' : '' 
                }`}
              >
                <tab.icon size={20} />
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={onLogout}
            className="absolute bottom-6 left-6 right-6 nav-item flex items-center gap-3 text-red-400 hover:bg-red-900/30"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

// Shop Form Component
function ShopForm({ 
  shop, 
  onSave, 
  onCancel,
  isShopAdmin = false,
  adminInfo = null
}: { 
  shop: Shop | null; 
  onSave: (shop: Shop) => void; 
  onCancel: () => void;
  isShopAdmin?: boolean;
  adminInfo?: { id: string; name: string; level: string } | null;
}) {
  const [formData, setFormData] = useState({
    shopName: shop?.shopName || '',
    shopCode: shop?.shopCode || '',
    qualifyingPurchase: shop?.qualifyingPurchase || 0,
    promoMessage: shop?.promoMessage || 'Play & Win Amazing Rewards!',
    isActive: shop?.isActive ?? true,
    deviceId: shop?.deviceId || '',
    deviceLocked: shop?.deviceLocked || false,
    adminEmail: shop?.adminEmail || '',
  });

  const handleRegisterDevice = () => {
    const newDeviceId = registerCurrentDevice();
    setFormData({ ...formData, deviceId: newDeviceId, deviceLocked: true });
  };

  const handleCopyDeviceId = () => {
    if (formData.deviceId) {
      navigator.clipboard.writeText(formData.deviceId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // When creating a new shop and admin is agent_admin, track who added it
    const isNewShop = !shop;
    const addedByInfo = (isNewShop && adminInfo?.level === 'agent_admin') 
      ? { addedBy: adminInfo.id, addedByName: adminInfo.name }
      : {};
    
    onSave({
      id: shop?.id || crypto.randomUUID(),
      ...formData,
      deviceId: formData.deviceId || crypto.randomUUID(),
      deviceLocked: formData.deviceLocked || false,
      createdAt: shop?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: shop?.createdBy || 'super_admin',
      backupEnabled: shop?.backupEnabled || false,
      adminEmail: formData.adminEmail,
      ...addedByInfo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Shop Name</label>
        <input
          type="text"
          value={formData.shopName}
          onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
          className="input"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Shop Code</label>
        <input
          type="text"
          value={formData.shopCode}
          onChange={(e) => setFormData({ ...formData, shopCode: e.target.value.toUpperCase() })}
          className="input"
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Shop Admin Email</label>
        <input
          type="email"
          value={formData.adminEmail}
          onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value.toLowerCase() })}
          className="input"
          placeholder="admin@example.com"
          required
        />
        <p className="text-xs text-gray-500 mt-1">This email must match the shop admin&apos;s login email</p>
      </div>
      {/* Qualifying Purchase - only editable by shop admin */}
      {isShopAdmin && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Qualifying Purchase (KSh)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formData.qualifyingPurchase}
            onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
            onChange={(e) => setFormData({ ...formData, qualifyingPurchase: Number(e.target.value) || 0 })}
            className="input"
            required
          />
        </div>
      )}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Promo Message</label>
        <input
          type="text"
          value={formData.promoMessage}
          onChange={(e) => setFormData({ ...formData, promoMessage: e.target.value })}
          className="input"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="w-4 h-4"
        />
        <label className="text-sm text-gray-300">Active</label>
      </div>

      {/* Device Registration */}
      <div className="border-t border-gray-700 pt-4 mt-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Device Authorization</h4>
        <div className="bg-gray-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.deviceLocked}
              onChange={(e) => setFormData({ ...formData, deviceLocked: e.target.checked })}
              className="w-4 h-4"
            />
            <label className="text-sm text-gray-300">Lock to this device</label>
          </div>
          
          {formData.deviceLocked && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Device ID</label>
                  <input
                    type="text"
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    className="input text-xs"
                    placeholder="No device registered"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCopyDeviceId}
                  className="mt-5 p-2 text-gray-400 hover:text-gold-400"
                  title="Copy Device ID"
                >
                  <Copy size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleRegisterDevice}
                className="btn-gold-outline w-full text-sm"
              >
                <Smartphone size={14} className="mr-2" />
                Register This Device
              </button>
              <p className="text-xs text-gray-500">
                Click to register current device. Only this device can play at this shop.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-gold flex-1">
          <Save size={16} className="mr-2" />
          Save
        </button>
        <button type="button" onClick={onCancel} className="btn-gold-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Admin Form Component
function AdminForm({
  admin,
  shops,
  admins,
  onSave,
  onCancel,
}: {
  admin: Admin | null;
  shops: Shop[];
  admins: Admin[];
  onSave: (admin: Admin) => void;
  onCancel: () => void;
}) {
  // Check if there's already a super_admin (excluding the admin being edited)
  // Only block creating another super_admin, allow agent_admin and shop_admin
  const existingSuperAdmin = admins.find(a => a.level === 'super_admin' && a.id !== admin?.id);
  const [formData, setFormData] = useState({
    name: admin?.name || '',
    email: admin?.email || '',
    phone: admin?.phone || '',
    level: admin?.level || 'shop_admin' as AdminLevel,
    isActive: admin?.isActive ?? true,
    assignedShops: admin?.assignedShops || [] as string[],
    region: admin?.region || '',
    deviceId: admin?.deviceId || '',
    deviceLocked: admin?.deviceLocked ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin) return;
    
    // Always use the selected level from form (not the current user's level)
    const finalLevel = formData.level;
    
    onSave({
      ...admin,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      level: finalLevel,
      isActive: formData.isActive,
      assignedShops: formData.assignedShops,
      region: formData.region,
      deviceId: formData.deviceLocked ? formData.deviceId : undefined,
      deviceLocked: formData.deviceLocked,
    });
  };

  const toggleShop = (shopId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedShops: prev.assignedShops.includes(shopId)
        ? prev.assignedShops.filter(id => id !== shopId)
        : [...prev.assignedShops, shopId]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="input"
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Admin Level</label>
          {existingSuperAdmin && (
            <div className="p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-400 text-sm mb-2">
              ⚠️ Only one Super Admin exists. Creating Agent or Shop Admin.
            </div>
          )}
          <select
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: e.target.value as AdminLevel })}
            className="input"
          >
            <option value="agent_admin">Agent Admin</option>
            <option value="shop_admin">Shop Admin</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Region</label>
        <input
          type="text"
          value={formData.region}
          onChange={(e) => setFormData({ ...formData, region: e.target.value })}
          className="input"
          placeholder="e.g., Nairobi, Mombasa"
        />
      </div>

      {(formData.level === 'shop_admin' || formData.level === 'agent_admin') && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            {formData.level === 'agent_admin' ? 'Shops to Oversee' : 'Assigned Shops'}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-gray-800 rounded-lg p-3">
            {shops.length === 0 ? (
              <p className="text-gray-500 text-sm">No shops available</p>
            ) : (
              shops.map(shop => (
                <label key={shop.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.assignedShops.includes(shop.id)}
                    onChange={() => toggleShop(shop.id)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-300">{shop.shopName}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="w-4 h-4"
        />
        <label className="text-sm text-gray-300">Active</label>
      </div>

      {/* Device Locking Section */}
      {/* Device lock - only for Shop Admin */}
      {formData.level === 'shop_admin' && (
        <div className="border-t border-gray-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="deviceLocked"
              checked={formData.deviceLocked}
              onChange={(e) => setFormData({ ...formData, deviceLocked: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="deviceLocked" className="text-sm text-gray-300 font-medium">
              Lock to This Device
            </label>
          </div>
          
          {formData.deviceLocked && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-3">
              <p className="text-xs text-gray-400">
                When enabled, this Shop Admin can only log in from this device.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Device ID</label>
                  <input
                    type="text"
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    className="input text-sm"
                    placeholder="Enter device ID or register"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, deviceId: getDeviceId() })}
                  className="btn-gold-outline mt-5"
                  title="Register current device"
                >
                  <Smartphone size={16} />
                </button>
              </div>
              {formData.deviceId && (
                <p className="text-xs text-gray-500">
                  Current device ID: {formData.deviceId.substring(0, 8)}...
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <button type="submit" className="btn-gold flex-1">
          <Save size={16} className="mr-2" />
          Save Staff
        </button>
        <button type="button" onClick={onCancel} className="btn-gold-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Item Form Component
function ItemForm({ 
  item, 
  qualifyingPurchase,
  onSave, 
  onCancel 
}: { 
  item: Item; 
  qualifyingPurchase: number;
  onSave: (item: Item) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: item.name,
    value: item.value,
    imageUrl: item.imageUrl || '',
    stockStatus: item.stockStatus,
    isActive: item.isActive,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(item.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  const isPriceValid = formData.value <= qualifyingPurchase * 0.8;

  // Handle file upload - convert to base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 500KB for offline storage)
    if (file.size > 500 * 1024) {
      alert('Image too large. Please use an image under 500KB');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setFormData({ ...formData, imageUrl: base64 });
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('Failed to read file');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Handle URL input change
  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, imageUrl: url });
    setImagePreview(url || null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPriceValid) {
      alert(`Item value must be <= 60% of qualifying purchase (KSh ${(qualifyingPurchase * 0.6).toLocaleString()})`);
      return;
    }
    onSave({
      ...item,
      ...formData,
      imageUrl: formData.imageUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Item Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm text-gray-400 mb-1">Item Image</label>
        
        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="h-24 w-24 object-cover rounded-lg border border-gray-600"
            />
            <button
              type="button"
              onClick={() => {
                setImagePreview(null);
                setFormData({ ...formData, imageUrl: '' });
              }}
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}
        
        {/* File Upload */}
        <div className="mb-2">
          <label className="flex items-center justify-center w-full h-12 px-4 transition bg-gray-800 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-gold-400 hover:bg-gray-750">
            <div className="flex items-center text-gray-400">
              {isUploading ? (
                <RefreshCw size={18} className="animate-spin mr-2" />
              ) : (
                <Upload size={18} className="mr-2" />
              )}
              <span className="text-sm">{isUploading ? 'Uploading...' : 'Click to upload image'}</span>
            </div>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Upload an image (max 500KB) or enter a URL below
          </p>
        </div>
        
        {/* URL Input (alternative) */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Or use Image URL</label>
          <input
            type="url"
            value={formData.imageUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            className="input"
            placeholder="https://example.com/image.jpg"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm text-gray-400 mb-1">Value (KSh)</label>
        <input
          type="number"
          value={formData.value}
          onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) })}
          className="input"
          required
        />
        <p className={`text-xs mt-1 ${isPriceValid ? 'text-green-400' : 'text-red-400'}`}>
          {isPriceValid 
            ? `✓ Within limit (max KSh ${(qualifyingPurchase * 0.8).toLocaleString()})`
            : `⚠ Exceeds limit (max KSh ${(qualifyingPurchase * 0.8).toLocaleString()})`
          }
        </p>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Stock Status</label>
        <select
          value={formData.stockStatus}
          onChange={(e) => setFormData({ ...formData, stockStatus: e.target.value as any })}
          className="input"
        >
          <option value="unlimited">Unlimited</option>
          <option value="in_stock">In Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="w-4 h-4"
        />
        <label className="text-sm text-gray-300">Active</label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-gold flex-1">
          <Save size={16} className="mr-2" />
          Save
        </button>
        <button type="button" onClick={onCancel} className="btn-gold-outline">
          Cancel
        </button>
      </div>
    </form>
  );
}
