'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Store, Package, Users, BarChart3, 
  Settings, LogOut, Menu, X, Plus, Edit, Trash2,
  Save, Smartphone, Power, PowerOff, Copy, UserCheck, UserPlus
} from 'lucide-react';
import { useAuthStore, useShopStore, useItemStore, useUIStore } from '@/store';
import { localItems, localAttempts, localAdmins, localPendingCustomers, clearAllData, localShops } from '@/lib/local-db';
import { firebaseShops, firebaseDb, firebaseSettings } from '@/lib/firebase';
import { generateDefaultItems, calculateShopAnalytics, validateItemPrice } from '@/lib/game-utils';
import { registerCurrentDevice, getDeviceId } from '@/lib/device';
import type { Shop, Item, AdminPermissions, Admin, AdminLevel, PendingCustomer } from '@/types';
import { ADMIN_PERMISSIONS } from '@/types';

type TabType = 'dashboard' | 'shops' | 'items' | 'attempts' | 'analytics' | 'settings' | 'staff' | 'myShop' | 'customers';

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

  // Customer management state (for 'customers' tab)
  const [pendingCustomers, setPendingCustomers] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ phoneNumber: '', purchaseAmount: '', itemId: '' });
  const [itemsList, setItemsList] = useState<Item[]>([]);

  const { admin, logout } = useAuthStore();
  const { currentShop, setCurrentShop } = useShopStore();
  const { items, setItems } = useItemStore();
  const { setCurrentView } = useUIStore();

  // Load customers data when shop changes
  useEffect(() => {
    if (activeTab === 'customers' && currentShop) {
      localPendingCustomers.getByShop(currentShop.id).then(setPendingCustomers);
      localItems.getByShop(currentShop.id).then(setItemsList);
    }
  }, [activeTab, currentShop]);

  // Get permissions based on admin level
  const permissions: AdminPermissions = admin?.level ? 
    (ADMIN_PERMISSIONS as any)[admin.level] : {
      canManageAdmins: false,
      canOnboardShops: false,
      canActivateShops: false,
      canEditQualifyingPurchase: false,
      canEditItems: false,
      canViewAnalytics: false,
      canBackupData: false,
      canManageSettings: false,
    };

  // Load shops on mount
  useEffect(() => {
    // Load shops from Firebase (primary) and fallback to local
    const loadShops = async () => {
      const fbShops = await firebaseShops.getAllActive();
      if (fbShops.length > 0) {
        setShops(fbShops);
      } else {
        // Fallback to local if Firebase has no shops
        const localShopList = await localShops.getAll();
        setShops(localShopList);
      }
    };
    loadShops();
    localAdmins.getAll().then(setAdmins);
  }, []);

  // Load terms content for super admin
  useEffect(() => {
    if (admin?.level === 'super_admin') {
      firebaseSettings.getSettings().then(settings => {
        setTermsContent(settings.termsContent);
      });
    }
  }, [admin]);

  // Admin handlers
  const handleSaveAdmin = async (adminData: Admin) => {
    // Check if trying to set as super_admin
    if (adminData.level === 'super_admin') {
      // Check if there's already a super admin
      const existingSuperAdmins = admins.filter(a => a.level === 'super_admin' && a.id !== adminData.id);
      if (existingSuperAdmins.length > 0) {
        alert('There can only be ONE Super Admin. Please contact the existing Super Admin to change this.');
        return;
      }
    }
    
    await localAdmins.save(adminData);
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
    { id: 'myShop', label: 'My Shop', icon: Store, requiredPermission: 'canEditQualifyingPurchase' },
    { id: 'customers', label: 'Customers', icon: UserCheck, requiredPermission: 'canEditQualifyingPurchase' },
    { id: 'shops', label: 'Shops', icon: Store, requiredPermission: 'canOnboardShops' },
    { id: 'items', label: 'Items', icon: Package, requiredPermission: 'canEditItems' },
    { id: 'attempts', label: 'Attempts', icon: Users, requiredPermission: 'canViewAnalytics' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, requiredPermission: 'canViewAnalytics' },
    { id: 'staff', label: 'Staff', icon: Users, requiredPermission: 'canManageAdmins' },
    { id: 'settings', label: 'Settings', icon: Settings, requiredPermission: 'canManageSettings' },
  ];

  // Filter tabs based on permissions
  const tabs = allTabs.filter(tab => 
    tab.requiredPermission === null || (permissions as any)[tab.requiredPermission]
  );

  // Save terms and conditions
  const handleSaveTerms = async () => {
    const result = await firebaseSettings.updateTerms(termsContent);
    if (result.success) {
      setTermsSaved(true);
      setIsEditingTerms(false);
      setTimeout(() => setTermsSaved(false), 3000);
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentView('login');
  };

  const loadAttempts = async () => {
    if (currentShop) {
      const shopAttempts = await localAttempts.getByShop(currentShop.id);
      setAttempts(shopAttempts);
    }
  };

  const loadItems = async () => {
    if (currentShop) {
      const shopItems = await localItems.getByShop(currentShop.id);
      setItems(shopItems.length > 0 ? shopItems : generateDefaultItems(currentShop.id));
    }
  };

  const handleSaveShop = async (shop: Shop) => {
    // Save to Firebase first, then local for offline
    await firebaseShops.save(shop);
    await localShops.save(shop);
    setEditingShop(null);
    setIsCreatingShop(false);
    // Refresh from Firebase
    const fbShops = await firebaseShops.getAllActive();
    setShops(fbShops);
  };

  const handleToggleShopActive = async (shop: Shop) => {
    const updatedShop = { ...shop, isActive: !shop.isActive };
    await firebaseShops.save(updatedShop);
    await localShops.save(updatedShop);
    const fbShops = await firebaseShops.getAllActive();
    setShops(fbShops);
  };

  const handleDeleteShop = async (shopId: string) => {
    if (confirm('Are you sure you want to delete this shop?')) {
      // Delete from Firebase
      await firebaseDb.delete('shops', shopId);
      // Delete from local
      await localShops.delete(shopId);
      await localItems.deleteByShop(shopId);
      // Refresh
      const fbShops = await firebaseShops.getAllActive();
      setShops(fbShops);
    }
  };

  const handleSaveItem = async (item: Item) => {
    await localItems.save(item);
    setEditingItem(null);
    loadItems();
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await localItems.delete(itemId);
      loadItems();
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
    const analytics = attempts.length > 0 ? calculateShopAnalytics(attempts) : null;
    
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
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
              
              <div className="card">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-900/50 flex items-center justify-center">
                    <Users className="text-green-500" size={24} />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Attempts</p>
                    <p className="text-2xl font-bold text-white">{attempts.length}</p>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setCurrentView('customer')}
                className="card hover:border-gold-500 transition-all text-left"
              >
                <Store className="text-gold-500 mb-2" size={24} />
                <h3 className="font-semibold text-white">Customer Mode</h3>
                <p className="text-gray-400 text-sm">Start a game session</p>
              </button>
              
              <button
                onClick={() => setActiveTab('items')}
                className="card hover:border-gold-500 transition-all text-left"
              >
                <Package className="text-gold-500 mb-2" size={24} />
                <h3 className="font-semibold text-white">Manage Items</h3>
                <p className="text-gray-400 text-sm">Update prizes & values</p>
              </button>
              
              {permissions.canBackupData && (
                <button
                  onClick={handleBackup}
                  className="card hover:border-gold-500 transition-all text-left"
                >
                  <Settings className="text-gold-500 mb-2" size={24} />
                  <h3 className="font-semibold text-white">Backup Data</h3>
                  <p className="text-gray-400 text-sm">Export all data</p>
                </button>
              )}
            </div>
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
    
    // For shop admins, only show their assigned shops
    // For super/agent admins, show all shops (or assigned if specified)
    const availableShops = isShopAdmin 
      ? shops.filter(s => assignedShopIds.includes(s.id))
      : assignedShopIds.length > 0 
        ? shops.filter(s => assignedShopIds.includes(s.id))
        : shops;
    
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
          <div className="max-w-2xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">My Shop</h1>
            
            {!currentShop ? (
              <div className="card">
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
                        }}
                        className="w-full card hover:border-gold-500 text-left"
                      >
                        <h4 className="font-semibold text-white">{shop.shopName}</h4>
                        <p className="text-gray-400 text-sm">Code: {shop.shopCode}</p>
                        <p className="text-gray-500 text-xs">
                          Qualifying: KSh {shop.qualifyingPurchase.toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="card mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white text-lg">{currentShop.shopName}</h3>
                      <p className="text-gray-400 text-sm">Code: {currentShop.shopCode}</p>
                    </div>
                    <button
                      onClick={() => setCurrentShop(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  {permissions.canEditQualifyingPurchase && (
                    <div className="mb-4">
                      <label className="block text-gray-400 text-sm mb-2">
                        Qualifying Purchase Amount (KSh)
                      </label>
                      <input
                        type="number"
                        value={currentShop.qualifyingPurchase}
                        onChange={async (e) => {
                          const newValue = parseInt(e.target.value) || 0;
      const updatedShop = { ...currentShop, qualifyingPurchase: newValue };
      await firebaseShops.save(updatedShop);
      await localShops.save(updatedShop);
      setCurrentShop(updatedShop);
      const fbShops = await firebaseShops.getAllActive();
      setShops(fbShops);
                        }}
                        className="input w-full"
                        min={0}
                        step={100}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Minimum purchase amount required to play
                      </p>
                    </div>
                  )}
                </div>
                
                {permissions.canEditItems && (
                  <div className="card">
                    <h3 className="font-semibold text-white mb-4">Quick Edit Items</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Go to the Items tab to edit prize values. 
                      Item values must be ≤ 80% of qualifying purchase (KSh {(currentShop.qualifyingPurchase * 0.8).toLocaleString()})
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
        
        <main className="flex-1 p-6">
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
                          <div>
                            <p className="text-white font-medium">{c.phoneNumber}</p>
                            <p className="text-gray-400 text-sm">
                              {c.itemName} - KSh {c.purchaseAmount.toLocaleString()}
                            </p>
                          </div>
                          <button 
                            onClick={() => handleDelete(c.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={18} />
                          </button>
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
        
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="gold-gradient-text text-3xl font-bold">Shops</h1>
              {permissions.canOnboardShops && (
                <button
                  onClick={() => setIsCreatingShop(true)}
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
                    }}
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
                      {permissions.canActivateShops && (
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
                      {permissions.canOnboardShops && (
                        <>
                          <button
                            onClick={() => setEditingShop(shop)}
                            className="p-2 text-blue-500 hover:bg-blue-900/30 rounded"
                          >
                            <Edit size={20} />
                          </button>
                          <button
                            onClick={() => handleDeleteShop(shop.id)}
                            className="p-2 text-red-500 hover:bg-red-900/30 rounded"
                          >
                            <Trash2 size={20} />
                          </button>
                        </>
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
        
        <main className="flex-1 p-6">
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
                              onClick={() => setEditingItem(item)}
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
                            ? '✓ Within 80% limit'
                            : '⚠ Exceeds 80% limit'}
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
                        onCancel={() => setEditingItem(null)}
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

  // Attempts view
  if (activeTab === 'attempts') {
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
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Game Attempts</h1>
            
            {currentShop ? (
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
                          Selected: Box {attempt.selectedBox}
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
    const analytics = attempts.length > 0 ? calculateShopAnalytics(attempts) : null;
    
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

  // Staff management view (Super Admin only)
  if (activeTab === 'staff') {
    const handleAddStaff = () => {
      setEditingAdmin({
        id: crypto.randomUUID(),
        email: '',
        phone: '',
        name: '',
        level: 'agent_admin',
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
        
        <main className="flex-1 p-6">
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
              <h3 className="font-semibold mb-4">Staff List</h3>
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
                            : staff.level === 'agent_admin'
                            ? 'bg-blue-900/50 text-blue-400'
                            : 'bg-green-900/50 text-green-400'
                        }`}>
                          {staff.level === 'super_admin' ? 'Super Admin' : staff.level === 'agent_admin' ? 'Agent Admin' : 'Shop Admin'}
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
        
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto">
            <h1 className="gold-gradient-text text-3xl font-bold mb-6">Settings</h1>
            
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Device Lock</h3>
                    <p className="text-gray-400 text-sm">Lock this shop to this device</p>
                  </div>
                  <button className="btn-gold-outline">
                    <Smartphone size={16} className="mr-2" />
                    Lock Device
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

              {/* Terms and Conditions - Super Admin Only */}
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
          <h1 className="gold-gradient-text text-2xl font-bold mb-8">MetoFun</h1>
          
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

          <div className="absolute bottom-20 left-6 right-6">
            <div className="card">
              <p className="text-white font-medium">{admin?.name || 'Admin'}</p>
              <p className="text-gray-400 text-sm capitalize">{admin?.level?.replace('_', ' ') || 'Admin'}</p>
            </div>
          </div>

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
  onCancel 
}: { 
  shop: Shop | null; 
  onSave: (shop: Shop) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    shopName: shop?.shopName || '',
    shopCode: shop?.shopCode || '',
    qualifyingPurchase: shop?.qualifyingPurchase || 100,
    promoMessage: shop?.promoMessage || 'Play & Win Amazing Rewards!',
    isActive: shop?.isActive ?? true,
    deviceId: shop?.deviceId || '',
    deviceLocked: shop?.deviceLocked || false,
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
    onSave({
      id: shop?.id || crypto.randomUUID(),
      ...formData,
      deviceId: formData.deviceId || crypto.randomUUID(),
      deviceLocked: formData.deviceLocked || false,
      createdAt: shop?.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: shop?.createdBy || 'admin',
      backupEnabled: shop?.backupEnabled || false,
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
        <label className="block text-sm text-gray-400 mb-1">Qualifying Purchase (KSh)</label>
        <input
          type="number"
          value={formData.qualifyingPurchase}
          onChange={(e) => setFormData({ ...formData, qualifyingPurchase: parseInt(e.target.value) })}
          className="input"
          required
        />
      </div>
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
  // Check if there's already a super admin (excluding the admin being edited)
  const existingSuperAdmin = admins.find(a => a.level === 'super_admin' && a.id !== admin?.id);
  const isEditingExistingSuperAdmin = admin?.level === 'super_admin';
  const [formData, setFormData] = useState({
    name: admin?.name || '',
    email: admin?.email || '',
    phone: admin?.phone || '',
    level: admin?.level || 'agent_admin' as AdminLevel,
    isActive: admin?.isActive ?? true,
    assignedShops: admin?.assignedShops || [] as string[],
    region: admin?.region || '',
    deviceId: admin?.deviceId || '',
    deviceLocked: admin?.deviceLocked ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin) return;
    
    // If editing existing super admin, preserve the level
    const finalLevel = isEditingExistingSuperAdmin ? 'super_admin' : formData.level;
    
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
          {existingSuperAdmin && !isEditingExistingSuperAdmin ? (
            <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-400 text-sm">
              ⚠️ Only one Super Admin allowed. A Super Admin already exists.
            </div>
          ) : (
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value as AdminLevel })}
              className="input"
            >
              <option value="agent_admin">Agent Admin</option>
              <option value="shop_admin">Shop Admin</option>
            </select>
          )}
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

      {formData.level === 'shop_admin' && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">Assigned Shops</label>
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
            Lock to Device
          </label>
        </div>
        
        {formData.deviceLocked && (
          <div className="bg-gray-800 rounded-lg p-3 space-y-3">
            <p className="text-xs text-gray-400">
              When enabled, this admin can only log in from the registered device.
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

  const isPriceValid = formData.value <= qualifyingPurchase * 0.8;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPriceValid) {
      alert(`Item value must be <= 80% of qualifying purchase (KSh ${(qualifyingPurchase * 0.8).toLocaleString()})`);
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
      
      {/* Image URL Field */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Image URL (optional)</label>
        <input
          type="url"
          value={formData.imageUrl}
          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          className="input"
          placeholder="https://example.com/image.jpg"
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter a URL for the item image
        </p>
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
