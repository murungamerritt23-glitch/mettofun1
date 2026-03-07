'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gift, Heart } from 'lucide-react';
import { useGameStore, useShopStore } from '@/store';
import { localNominationItems, localCustomerNominations } from '@/lib/local-db';
import type { NominationItem } from '@/types';

export default function NominationScreen() {
  const [items, setItems] = useState<NominationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
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
    if (!currentGameAttemptId || !customerSession) return;
    
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
      
      // Save the nomination
      await localCustomerNominations.save(nomination);
      
      // Increment the item's nomination count ONLY if NOT in test mode
      if (!isTestMode) {
        await localNominationItems.incrementNominationCount(item.id);
      }
      
      // Mark that this customer has nominated this attempt
      setHasNominatedThisAttempt(true);
      
      // Reload items to show updated counts
      if (currentShop) {
        const updatedItems = await localNominationItems.getByShop(currentShop.id);
        setItems(updatedItems);
      }
      
      setShowSuccess(true);
      setIsSaving(false);
      
    } catch (error) {
      console.error('Error saving nomination:', error);
      setIsSaving(false);
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
      exit: 'Exit'
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
      exit: 'Toka'
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Only show active items, sorted by nomination count
  const activeItems = items
    .filter(item => item.isActive)
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
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-4xl mb-2"
          >
            <Heart className="w-12 h-12 mx-auto text-pink-500" />
          </motion.div>
          <h2 className="gold-gradient-text text-2xl font-bold mb-2">
            {t.title}
          </h2>
          <p className="text-gray-400 text-sm">
            {t.subtitle}
          </p>
        </div>
      </div>

      {/* Item Grid */}
      <div className="max-w-md mx-auto">
        <p className="text-gray-500 text-sm text-center mb-3">
          {t.selectPrompt}
        </p>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 max-h-[50vh] overflow-y-auto">
          {activeItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNominate(item)}
              disabled={isSaving}
              className={`game-box p-2 sm:p-3 flex flex-col items-center justify-center ${
                isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
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
