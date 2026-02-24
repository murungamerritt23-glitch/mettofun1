'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, ArrowLeft, Plus, Search, MapPin, Check, Lock } from 'lucide-react';
import { useShopStore, useUIStore, useGameStore } from '@/store';
import { localShops } from '@/lib/local-db';
import { isDeviceAuthorized, getDeviceId } from '@/lib/device';
import type { Shop } from '@/types';

export default function ShopSelector() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newShopCode, setNewShopCode] = useState('');
  
  const { shops, setCurrentShop, addShop } = useShopStore();
  const { setCurrentView } = useUIStore();
  const { language } = useGameStore();
  
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const filteredShops = shops.filter(shop => 
    shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.shopCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectShop = async (shop: Shop) => {
    setDeviceError(null);
    
    // Check if device is authorized for this shop
    const authorized = isDeviceAuthorized(shop.deviceId, shop.deviceLocked);
    
    if (!authorized) {
      setDeviceError(
        language === 'sw'
          ? `Kifaa hiki hakikiriwa kwa duka hili! Wasiliana na msimamizi.`
          : `This device is not authorized for this shop! Contact administrator.`
      );
      return;
    }
    
    setCurrentShop(shop);
    setCurrentView('customer');
  };

  const handleCreateShop = async () => {
    if (!newShopCode.trim()) return;
    
    const newShop: Shop = {
      id: crypto.randomUUID(),
      shopName: `Shop ${newShopCode}`,
      shopCode: newShopCode.toUpperCase(),
      deviceId: crypto.randomUUID(),
      deviceLocked: false,
      qualifyingPurchase: 100,
      promoMessage: 'Play & Win Amazing Rewards!',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'demo-admin',
      backupEnabled: false
    };
    
    await localShops.save(newShop);
    addShop(newShop);
    setNewShopCode('');
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <button
          onClick={() => setCurrentView('login')}
          className="flex items-center gap-2 text-gray-400 hover:text-gold-400 mb-4"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        
        <h1 className="gold-gradient-text text-3xl font-bold text-center mb-2">
          Select Shop
        </h1>
        <p className="text-gray-400 text-center mb-6">
          Choose a shop to continue
        </p>

        {/* Device Error Alert */}
        {deviceError && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4 flex items-center gap-3">
            <Lock className="text-red-400 flex-shrink-0" size={24} />
            <p className="text-red-400 text-sm">{deviceError}</p>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
            placeholder="Search shops..."
          />
        </div>

        {/* Add Shop Button */}
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="btn-gold-outline w-full mb-4 flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Add New Shop
        </button>

        {/* Create Shop Form */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card mb-4"
            >
              <input
                type="text"
                value={newShopCode}
                onChange={(e) => setNewShopCode(e.target.value)}
                className="input mb-3"
                placeholder="Enter shop code"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateShop()}
              />
              <button
                onClick={handleCreateShop}
                className="btn-gold w-full"
              >
                Create Shop
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Shop List */}
      <div className="max-w-2xl mx-auto space-y-3">
        {filteredShops.length === 0 ? (
          <div className="text-center py-12">
            <Store size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-500">No shops found</p>
            <p className="text-gray-600 text-sm">Create a shop to get started</p>
          </div>
        ) : (
          filteredShops.map((shop, index) => (
            <motion.button
              key={shop.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleSelectShop(shop)}
              className="card w-full text-left hover:border-gold-500 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold-900/50 flex items-center justify-center">
                    <Store size={24} className="text-gold-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-gold-400">
                      {shop.shopName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin size={14} />
                      <span>{shop.shopCode}</span>
                      {shop.deviceLocked && (
                        <span className="px-2 py-0.5 bg-red-900/50 text-red-400 rounded text-xs">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Check className="text-gold-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Customer Mode Link */}
      <div className="max-w-2xl mx-auto mt-8 text-center">
        <button
          onClick={() => setCurrentView('customer')}
          className="text-gold-400 hover:text-gold-300 text-sm"
        >
          Or continue as customer without shop →
        </button>
      </div>
    </div>
  );
}
