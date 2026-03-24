'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gift, Heart, Search } from 'lucide-react';
import { useGameStore, useShopStore, useAuthStore } from '@/store';
import { localNominationItems, localCustomerNominations } from '@/lib/local-db';
import { saveNominationWithSync, saveNominationItemWithSync } from '@/lib/sync-service';
import type { NominationItem } from '@/types';

export default function NominationScreen() {
  const [items, setItems] = useState<NominationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tappedItemId, setTappedItemId] = useState<string | null>(null); // Visual feedback for tapped item
  
  const { 
    language, 
    setGameStatus, 
    currentGameAttemptId, 
    hasNominatedThisAttempt,
    setHasNominatedThisAttempt,
    customerSession,
    resetGame,
    isTestMode
  } = useGameStore();
  
  const { currentShop } = useShopStore();
  const { admin } = useAuthStore();

  // Test mode should only affect super_admin - shop_admin always uses real mode
  const isSuperAdminTestMode = isTestMode && admin?.level === 'super_admin';

  // Load nomination items on mount
  useEffect(() => {
    const loadItems = async () => {
      if (!currentShop) return;
      
      // Load or create default items
      const nominationItems = await localNominationItems.ensureDefaultItems(currentShop.id);
      setItems(nominationItems);
      setIsLoading(false);
    };
    
    loadItems();
  }, [currentShop]);

  const handleNominate = async (item: NominationItem) => {
    if (!currentGameAttemptId || !customerSession || isSaving) return;
    
    // Visual feedback - show tapped animation
    setTappedItemId(item.id);
    
    setIsSaving(true);
    
    try {
      // Create customer nomination record
      const nomination = {
        id: crypto.randomUUID(),
        phoneNumber: customerSession.phoneNumber,
        shopId: currentShop?.id || 'demo',
        itemId: item.id,
        gameAttemptId: currentGameAttemptId,
        timestamp: new Date(),
        synced: false
      };
      
      // Save the nomination with offline sync support
      await saveNominationWithSync(nomination);
      
      // Increment the item's nomination count ONLY if NOT in super admin test mode
      if (!isSuperAdminTestMode) {
        await localNominationItems.incrementNominationCount(item.id);
        // Get the fresh item from DB to get the updated nomination count
        const freshItem = await localNominationItems.get(item.id);
        if (freshItem) {
          // Sync the updated item to Firebase if online
          await saveNominationItemWithSync(freshItem, false);
        }
      }
      
      // Mark that this customer has nominated this attempt
      setHasNominatedThisAttempt(true);
      
      // Reload items to show updated counts
      if (currentShop) {
        const updatedItems = await localNominationItems.getByShop(currentShop.id);
        setItems(updatedItems);
      }
      
      // Show success after animation
      setTimeout(() => {
        setShowSuccess(true);
        setIsSaving(false);
        setTappedItemId(null);
      }, 400);
      
    } catch (error) {
      console.error('Error saving nomination:', error);
      setIsSaving(false);
      setTappedItemId(null);
      alert(language === 'sw' ? 'Hitilafu wakati wa kuhifadhi' : 'Error saving nomination');
    }
  };

  const handleExit = () => {
    // Reset game state for next customer
    resetGame();
  };

  const translations = {
    en: {
      title: 'Feedback Time!',
      subtitle: 'What prize would you like to see more of?',
      skip: 'Skip',
      nominate: 'Nominate',
      nominated: 'Nominated!',
      nominations: 'nominations',
      selectPrompt: 'Tap an item to nominate it',
      alreadyNominated: 'You have already nominated this attempt',
      thankYou: 'Thank you for your feedback!',
      exit: 'Exit',
      searchPlaceholder: 'Search items...'
    },
    sw: {
      title: 'Wakati wa Maoni!',
      subtitle: 'Ni zawadi gani ungependa kuiona zaidi?',
      skip: 'Ruka',
      nominate: 'Pendekeza',
      nominated: 'Imependekezwa!',
      nominations: 'mapendekezo',
      selectPrompt: 'Gusa kitufe kuchagua',
      alreadyNominated: 'Tayari umependekeza katika jaribio hili',
      thankYou: 'Asante kwa maoni yako!',
      exit: 'Toka',
      searchPlaceholder: 'Search items...'
    }
  };

  const t = translations[language];

  // Already nominated
  if (hasNominatedThisAttempt) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="card-gold">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="text-6xl mb-4"
            >
              <Heart className="w-20 h-20 mx-auto text-pink-500" />
            </motion.div>
            
            <h2 className="gold-gradient-text text-2xl font-bold mb-2">
              {t.alreadyNominated}
            </h2>
            
            <p className="text-gray-400 mb-6">
              {t.thankYou}
            </p>
            
            <button onClick={handleExit} className="btn-gold w-full">
              {t.exit}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success animation
  if (showSuccess) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="gold-gradient-text text-3xl font-bold mb-2">
              {t.nominated}
            </h2>
            <p className="text-gray-400">{t.thankYou}</p>
            
            <button onClick={handleExit} className="btn-gold w-full mt-6">
              {t.exit}
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1628]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
      </div>
    );
  }

  // Only show active items, sorted by nomination count (filtered by search if query exists)
  const activeItems = items
    .filter(item => item.isActive)
    .filter(item => 
      searchQuery.trim() === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.nominationCount - a.nominationCount);

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="max-w-md mx-auto mb-4">
        <button
          onClick={handleExit}
          className="flex items-center gap-2 text-gray-400 hover:text-gold-400 mb-4"
        >
          <ArrowLeft size={20} />
          {language === 'sw' ? 'Rudi' : 'Back'}
        </button>

        <div className="text-center">
          <Heart className="w-12 h-12 mx-auto text-pink-500 mb-2" />
          <h2 className="gold-gradient-text text-2xl font-bold mb-2">
            {t.title}
          </h2>
          <p className="text-gray-400 text-sm">
            {t.subtitle}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-md mx-auto mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.searchPlaceholder}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gold-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Item Grid */}
      <div className="max-w-md mx-auto">
        <p className="text-gray-500 text-sm text-center mb-3">
          {t.selectPrompt}
        </p>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 max-h-[50vh] overflow-y-auto">
          {activeItems.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-400">
              {searchQuery 
                ? (language === 'sw' ? 'Hakuna matokeo yapatikana' : 'No items found')
                : (language === 'sw' ? 'Hakuna vyakula vya kuonyesha' : 'No items available')
              }
            </div>
          ) : activeItems.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNominate(item)}
                disabled={isSaving}
                className={`game-box p-2 sm:p-3 flex flex-col items-center justify-center relative ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                } ${tappedItemId === item.id ? 'nomination-success' : ''}`}
              >
                {/* Rank badge for top items */}
                {index < 3 && (
                  <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-500 text-black' :
                    index === 1 ? 'bg-gray-400 text-black' :
                    'bg-amber-700 text-white'
                  }`}>
                    {index + 1}
                  </div>
                )}
                
                {item.imageUrl ? (
                  <img 
                    src={item.imageUrl} 
                    alt={item.name}
                    className="w-8 h-8 object-cover rounded mb-1"
                  />
                ) : (
                  <Gift className="w-6 h-6 sm:w-8 sm:h-8 mb-1 text-gold-400" />
                )}
                
                <span className="text-xs font-medium truncate w-full text-center">
                  {item.name}
                </span>
                
                <span className="text-[10px] text-gold-400">
                  KSh {item.value.toLocaleString()}
                </span>
                
                {/* Nomination count */}
                <div className="flex items-center gap-1 mt-1">
                  <Heart className="w-3 h-3 text-pink-500" />
                  <span className="text-[10px] text-pink-400">
                    {item.nominationCount}
                  </span>
                </div>
              </motion.button>
            ))}
        </div>
      </div>

      {/* Exit button */}
      <div className="max-w-md mx-auto mt-6">
        <button
          onClick={handleExit}
          className="btn-gold-outline w-full"
        >
          {t.exit}
        </button>
      </div>
    </div>
  );
}
