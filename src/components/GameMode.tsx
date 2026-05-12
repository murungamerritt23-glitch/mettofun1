'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gift, ArrowLeft, Volume2, VolumeX, RefreshCw, 
  Check, X, Star, Zap, Trophy, Sparkles, Languages, MapPin, Heart, Settings, LogOut
} from 'lucide-react';
import { useGameStore, useShopStore, useItemStore, useUIStore, useAuthStore } from '@/store';
import { localItems, localAttempts, localSettings } from '@/lib/local-db';
import { saveAttemptWithSync } from '@/lib/sync-service';
import { 
  calculateBoxConfiguration, 
  generateSecureRandomNumber,
  createGameAttempt,
  getCurrentDateString,
  isValidPhoneNumber,
  formatPhoneNumber,
  validateGameAttempt
} from '@/lib/game-utils';
import type { Item, GameAttempt } from '@/types';
import { verifyShopLocation } from '@/lib/location';
import NominationScreen from './NominationScreen';

export default function GameMode() {
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showNumberPicker, setShowNumberPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [winningItem, setWinningItem] = useState<Item | null>(null);
  const [todayAttempts, setTodayAttempts] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0); // For DPAD navigation
  const [selectedNumberIndex, setSelectedNumberIndex] = useState(0); // For DPAD number navigation
  const [tappedItemId, setTappedItemId] = useState<string | null>(null); // Visual feedback for tapped item
  const [tappedBoxNum, setTappedBoxNum] = useState<number | null>(null); // Visual feedback for tapped box
  const [tappedNumber, setTappedNumber] = useState<number | null>(null); // Visual feedback for tapped number

  const { 
    gameStatus, setGameStatus, 
    selectedBox, setSelectedBox,
    correctNumber, setCorrectNumber,
    thresholdNumber, setThresholdNumber,
    customerSession, setCustomerSession,
    selectedItem, setSelectedItem,
    isDemoMode, setDemoMode,
    language, setLanguage,
    currentGameAttemptId, setCurrentGameAttemptId,
    hasNominatedThisAttempt, setHasNominatedThisAttempt,
    isTestMode, testPhonePrefix,
    itemOfTheDay,
    hasLikedItemOfDay,
    setHasLikedItemOfDay,
    incrementItemOfDayLikes,
    resetGame,
    clearTestData
  } = useGameStore();
  
  const { currentShop, setCurrentShop } = useShopStore();
  const { items, setItems } = useItemStore();
  const { setCurrentView } = useUIStore();
  const { admin, logout } = useAuthStore();

  // Test mode should only apply for super_admin in customer mode
  // For shop_admin and agent_admin, always use real mode (test mode doesn't affect them)
  const isSuperAdminTestMode = isTestMode && admin?.level === 'super_admin';

  // Load Item of the Day on mount with live RTDB sync
  useEffect(() => {
    const loadItemOfDay = async () => {
      // Try local first
      const savedItem = await localSettings.get('itemOfTheDay');
      if (savedItem) {
        useGameStore.getState().setItemOfTheDay(savedItem);
      }

      // Non-blocking RTDB fetch for new devices
      try {
        const { rtdbSettings } = await import('@/lib/firebase');
        const rtdbItem = await rtdbSettings.get('itemOfTheDay');
        if (rtdbItem) {
          // Preserve local likes if RTDB has fewer (in case offline likes happened)
          if (savedItem && rtdbItem.likes < savedItem.likes) {
            rtdbItem.likes = savedItem.likes;
            await rtdbSettings.set('itemOfTheDay', rtdbItem);
          }
          localSettings.set('itemOfTheDay', rtdbItem);
          useGameStore.getState().setItemOfTheDay(rtdbItem);
        }
      } catch (e) {}

      // Listen for real-time IOTD changes from RTDB (live likes across devices)
      try {
        const { rtdbSettings } = await import('@/lib/firebase');
        const unsubscribe = rtdbSettings.onSettingChange('itemOfTheDay', async (rtdbItem: any) => {
          if (rtdbItem) {
            // Always update local and store - the server is authoritative for likes
            await localSettings.set('itemOfTheDay', rtdbItem);
            useGameStore.getState().setItemOfTheDay(rtdbItem);
          }
        });
        return () => {
          unsubscribe();
        };
      } catch (e) {
        // If RTDB listener fails, fall back to polling
        const fallbackSync = async () => {
          try {
            const { rtdbSettings } = await import('@/lib/firebase');
            const rtdbItem = await rtdbSettings.get('itemOfTheDay');
            if (rtdbItem) {
              const localItem = await localSettings.get('itemOfTheDay');
              if (localItem && rtdbItem.likes < localItem.likes) {
                rtdbItem.likes = localItem.likes;
                await rtdbSettings.set('itemOfTheDay', rtdbItem);
              }
              localSettings.set('itemOfTheDay', rtdbItem);
              useGameStore.getState().setItemOfTheDay(rtdbItem);
            }
          } catch (e) {}
        };
        fallbackSync();
        const syncInterval = setInterval(fallbackSync, 30000);
        return () => clearInterval(syncInterval);
      }
    };
    loadItemOfDay();
  }, []);

  // Load shop items - always fresh from DB to get latest updates (images, etc)
  // Also refresh when component becomes visible (via currentView changes to customer)
  useEffect(() => {
    let isCancelled = false;

    const loadItems = async () => {
      if (!currentShop) {
        // No shop selected yet - still need to clear loading
        setIsLoading(false);
        return;
      }

      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Items loading timeout')), 15000)
        );

        // Always load fresh from DB - this ensures updated images are seen
        const shopItems = await Promise.race([
          localItems.getByShop(currentShop.id),
          timeoutPromise
        ]) as Item[];

        if (isCancelled) return;

        // Use whatever is in DB - no overwriting, just load and display
        let finalItems = shopItems;

        // Only create missing items if less than 17 exist (preserve DB data)
        if (finalItems.length < 17) {
          const missingCount = 17 - finalItems.length;
          const newItems = Array.from({ length: missingCount }, (_, i) => ({
            id: `${currentShop.id}-item-${finalItems.length + i + 1}`,
            name: `Prize ${finalItems.length + i + 1}`,
            value: (finalItems.length + i + 1) * 1000,
            stockStatus: 'unlimited' as const,
            isActive: true,
            shopId: currentShop.id,
            order: finalItems.length + i
          }));
          finalItems = [...finalItems, ...newItems];
          // Only save the NEW items, never overwrite existing
          if (newItems.length > 0) {
            await localItems.saveMultiple(newItems);
          }
        }

        setItems(finalItems);
      } catch (error) {
        console.error('Failed to load items:', error);
        // Set flag to prevent auto-login loop on restart
        localStorage.setItem('metofun-load-timeout', Date.now().toString());
        // Set default items on error
        if (currentShop && !isCancelled) {
          const defaultItems = Array.from({ length: 17 }, (_, i) => ({
            id: `${currentShop.id}-item-${i + 1}`,
            name: `Prize ${i + 1}`,
            value: (i + 1) * 1000,
            stockStatus: 'unlimited' as const,
            isActive: true,
            shopId: currentShop.id,
            order: i
          }));
          setItems(defaultItems);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadItems();
    return () => { isCancelled = true; };
  }, [currentShop, setItems]);

  // Poll for item updates every 3 seconds when item picker screen is shown
  // This catches changes from AdminDashboard immediately
  useEffect(() => {
    if (!currentShop || !showItemPicker) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const freshItems = await localItems.getByShop(currentShop.id);
        setItems(freshItems);
      } catch (e) {
        // Silent fail on polling errors
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [currentShop, showItemPicker, setItems]);

  // Check today's attempts for demo mode
  useEffect(() => {
    const checkAttempts = async () => {
      if (isDemoMode && phoneNumber) {
        const attempts = await localAttempts.getByPhone(phoneNumber);
        const today = getCurrentDateString();
        const todayAttemptsList = attempts.filter(
          a => new Date(a.timestamp).toISOString().split('T')[0] === today
        );
        setTodayAttempts(todayAttemptsList.length);
      }
    };
    checkAttempts();
  }, [isDemoMode, phoneNumber]);

  const handleAuthorize = async () => {
    // Check if shop is active - block game if deactivated by super admin
    if (currentShop && currentShop.isActive === false) {
      alert(language === 'sw' 
        ? 'Duka hili limezimwa. Wasiliana na msimamizi.' 
        : 'This shop is deactivated. Contact admin.'
      );
      return;
    }
    
    // More lenient validation - accept any phone number with at least 7 digits
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 7) {
      alert(language === 'sw' ? 'Tafadhali ingiza nambari ya simu sahihi' : 'Please enter a valid phone number');
      return;
    }
    
    // Handle empty or invalid purchase amount - show error if invalid
    let amount = parseFloat(purchaseAmount);
    if (isNaN(amount) || amount < 0) {
      alert(language === 'sw' ? 'Tafadhali ingiza kiwango sahihi cha manunuzi' : 'Please enter a valid purchase amount');
      return;
    }
    
    const qualifyingPurchase = Number(currentShop?.qualifyingPurchase) || 0;
    
    // If qualifying purchase is set, enforce minimum
    if (qualifyingPurchase > 0 && amount < qualifyingPurchase) {
      alert(
        language === 'sw'
          ? `Kiwango cha chini ni KSh ${qualifyingPurchase.toLocaleString()}. Tafadhali ingiza kiwango cha juu au sawa na ${qualifyingPurchase.toLocaleString()}.`
          : `Minimum purchase is KSh ${qualifyingPurchase.toLocaleString()}. Please enter an amount equal to or above ${qualifyingPurchase.toLocaleString()}.`
      );
      return;
    }

    // Validate that shop is available
    if (!currentShop) {
      alert(language === 'sw' ? 'Hakuna duka lililochaguliwa' : 'No shop selected');
      return;
    }

    setIsAuthorizing(true);
    setLocationError(null);
    
    // Check if user is at the shop location (non-blocking - allow play if it fails)
    try {
      const locationResult = await verifyShopLocation(currentShop?.location);
      
      if (!locationResult.isValid) {
        // Show warning but allow play (location is advisory only)
        setLocationError(
          language === 'sw' 
            ? `Maonyo: ${locationResult.error || 'Hauko karibu na duka.'}`
            : `Warning: ${locationResult.error || 'Not near shop (playing anyway).'}`
        );
      }
    } catch (error) {
      // Location check failed - allow play anyway (non-blocking)
      console.log('Location verification skipped:', error);
    }
    
    // Simulate authorization
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Use test phone prefix only if super admin has test mode enabled
    const formattedPhone = isSuperAdminTestMode 
      ? `${testPhonePrefix}-${formatPhoneNumber(phoneNumber)}` 
      : formatPhoneNumber(phoneNumber);
    
    const config = calculateBoxConfiguration(amount, qualifyingPurchase);
    
    setCustomerSession({
      phoneNumber: formattedPhone,
      attemptsToday: 0,
      lastAttemptDate: getCurrentDateString(),
      authorized: true,
      purchaseAmount: amount
    });
    
    // Update state with parsed amount
    setPurchaseAmount(String(amount));
    
    // Store the threshold for display purposes
    const threshold = config.threshold;
    setThresholdNumber(threshold);
    
    setGameStatus('playing');
    setShowItemPicker(true); // Show item selection first
    setIsAuthorizing(false);
  };

  const handleBoxSelect = (boxIndex: number) => {
    if (gameStatus !== 'playing' || selectedBox !== null) return;
    
    // Visual feedback - show tapped animation
    setTappedBoxNum(boxIndex);
    setTimeout(() => setTappedBoxNum(null), 500);
    
    setSelectedBox(boxIndex);
    setShowNumberPicker(true);
  };

 const handleItemSelect = (item: Item) => {
  if (!item || !item.isActive) return;
  
  setTappedItemId(item.id);
  setTimeout(() => setTappedItemId(null), 400);
  
  setSelectedItem(item);
  
  // Generate RANDOM winning number from available range (1 to 18-threshold)
  // This makes the game fair and unpredictable
  const threshold = thresholdNumber || 1;
  const winningNum = generateSecureRandomNumber(18 - threshold);
  setCorrectNumber(winningNum);
  
  setShowItemPicker(false);
  setShowNumberPicker(true);
}; 

  const handleNumberSelect = (number: number) => {
    if (selectedNumber !== null || !correctNumber) return;
    
    setSelectedNumber(number);
    
    // Check if won - player wins only if selected number === correctNumber (exact match)
    const won = number === correctNumber;
    setGameWon(won);
    
    if (won) {
      // Show the exact item customer selected - not a different one
      setWinningItem(selectedItem);
      setSelectedItem(selectedItem);
    }
    
    // Save attempt in background - don't await to avoid blocking
    try {
      // Validate attempt before saving
      const validation = validateGameAttempt(
        currentShop?.id || 'demo',
        customerSession?.phoneNumber || phoneNumber,
        parseFloat(purchaseAmount),
        currentShop?.qualifyingPurchase || 0,
        selectedBox || 0,
        correctNumber,
        won,
        thresholdNumber ?? undefined
      );
      
      if (!validation.valid) {
        console.error('Invalid game attempt:', validation.error);
        // Still show result to user but don't save invalid attempt
        setShowResult(true);
        setGameStatus(won ? 'won' : 'lost');
        return;
      }
      
      const attempt = createGameAttempt(
        currentShop?.id || 'demo',
        customerSession?.phoneNumber || phoneNumber,
        parseFloat(purchaseAmount),
        currentShop?.qualifyingPurchase || 0,
        selectedBox || 0,
        correctNumber,
        won,
        selectedItem || undefined,
        isSuperAdminTestMode
      );
      
      // Fire and forget - don't await
      saveAttemptWithSync(attempt).catch(err => console.error('Sync error:', err));
      
      // Store the attempt ID for nomination tracking
      setCurrentGameAttemptId(attempt.id);
    } catch (error) {
      console.error('Error saving game attempt:', error);
    }
    
    setShowResult(true);
    setGameStatus(won ? 'won' : 'lost');
  };

  const handlePlayAgain = async () => {
    // Fresh game session - no time restrictions
    // After results are displayed (win/loss), next entry always starts fresh
    
    // Reset liked state for fresh session (allows new like on item of the day)
    setHasLikedItemOfDay(false);
    
    // Recalculate threshold only - winning number must NOT be set here.
    // The winning number is generated in handleItemSelect, AFTER the customer picks an item.
    // This ensures the game is fair and the outcome is not predetermined before item selection.
    const config = calculateBoxConfiguration(
      parseFloat(purchaseAmount), 
      currentShop?.qualifyingPurchase || 0
    );
    const newThreshold = config.threshold;
    setThresholdNumber(newThreshold);
    
    // Reset game state
    setSelectedBox(null);
    setSelectedNumber(null);
    setShowResult(false);
    setShowNumberPicker(false);
    setShowItemPicker(true); // Show item picker first so customer selects item before winning number is generated
    setGameStatus('playing');
    setWinningItem(null);
    setSelectedItem(null);
    setCurrentGameAttemptId(null);
  };

  const handleExit = () => {
    resetGame();
    setShowItemPicker(false);
    setSelectedItem(null);
    setCurrentView('shop-select');
  };

  const handleNominate = () => {
    setGameStatus('nominating');
  };

  const handleSkipNominate = () => {
    // Full reset for new customer - clear everything
    resetGame();
    setPhoneNumber('');
    setPurchaseAmount('');
    setShowItemPicker(false);
    setShowNumberPicker(false);
    setShowResult(false);
    setSelectedNumber(null);
    setWinningItem(null);
    setGameStatus('idle');
  };

  const handleRefresh = () => {
    // Clear phone and purchase amount fields only
    // Note: Test mode is controlled ONLY by super admin in AdminDashboard
    // Shop admins cannot affect test mode - it runs independently
    setPhoneNumber('');
    setPurchaseAmount('');
    // Reset all game state for a fresh session
    resetGame();
    setShowItemPicker(false);
    setShowNumberPicker(false);
    setShowResult(false);
    setSelectedNumber(null);
    setSelectedBox(null);
    setWinningItem(null);
    setGameStatus('idle');
    // CRITICAL: Reset nomination flag so user can nominate again in new session
    setHasNominatedThisAttempt(false);
    setHasLikedItemOfDay(false);
  };

  const handleDemoMode = () => {
    setDemoMode(true);
    setPhoneNumber('254700000000');
    setPurchaseAmount('15000');
    handleAuthorize();
  };

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

  const config = customerSession?.purchaseAmount 
    ? calculateBoxConfiguration(customerSession.purchaseAmount, currentShop?.qualifyingPurchase || 0)
    : { boxCount: 17, ratio: '<150%' };

  const translations = {
    en: {
      title: 'EtoFun',
      subtitle: 'Win Amazing Rewards!',
      qualifyingPurchase: 'Qualifying Purchase',
      enterPhone: 'Enter Phone Number',
      enterAmount: 'Purchase Amount (KSh)',
      authorize: 'Start Game',
      demoMode: 'Demo Mode',
      selectBox: 'Select a Box',
      selectNumber: 'Pick Your Lucky Number',
      youWon: '🎉 Congratulations!',
      youLost: '😔 Better Luck Next Time!',
      playAgain: 'Play Again',
      exit: 'Exit',
      language: 'Language',
      box: 'Box',
      nominate: 'Give Feedback',
      skipNominate: 'Skip'
    },
    sw: {
      title: 'EtoFun',
      subtitle: 'Shinda Ajira Za Kushangaza!',
      qualifyingPurchase: 'Manunuzi Yanayokubali',
      enterPhone: 'Weka Nambari ya Simu',
      enterAmount: 'Kiwango cha Manunuzi (KSh)',
      authorize: 'Anza Kucheza',
      demoMode: 'Hali ya Demo',
      selectBox: 'Chagua Sanduku',
      selectNumber: 'Chagua Nambari yako',
      youWon: '🎉 Hongera!',
      youLost: '😔 Wawezekana Next Time!',
      playAgain: 'Cheza Tena',
      exit: 'Toka',
      language: 'Lugha',
      box: 'Sanduku',
      nominate: 'Toa Maoni',
      skipNominate: 'Ruka'
    }
  };

  const t = translations[language];

  // Show nomination screen when user chooses to nominate
  if (gameStatus === 'nominating') {
    return <NominationScreen />;
  }

  // Game not started - show authorization form
  if (gameStatus === 'idle') {
    return (
      <div className="min-h-screen p-4 relative overflow-auto">
        {/* Header */}
        <div className="max-w-md mx-auto mb-6">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-gray-400 hover:text-gold-400 mb-4"
          >
            <ArrowLeft size={20} />
            {language === 'sw' ? 'Rudi' : 'Back'}
          </button>

          {/* Admin Menu - Visible to all admins */}
          {admin && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => {
                  // Clear local storage auth
                  localStorage.removeItem('metofun-auth');
                  localStorage.removeItem('metofun-auth-pw');
                  // Clear shop from store
                  setCurrentShop(null);
                  // Navigate to login
                  setCurrentView('login');
                  // Reset auth state
                  logout();
                }}
                className="p-2 text-gray-400 hover:text-red-400"
                title={language === 'sw' ? 'Toka' : 'Logout'}
              >
                <LogOut size={24} />
              </button>
              <button
                onClick={() => setCurrentView('admin')}
                className="p-2 text-gray-400 hover:text-gold-400"
                title={language === 'sw' ? 'Dashibodi ya Admin' : 'Admin Dashboard'}
              >
                <Settings size={24} />
              </button>
            </div>
          )}

          {/* Shop Info */}
          {currentShop && (
            <div className="card text-center mb-6">
              <img 
                src="/metofun-logo.png" 
                alt="ETO FUN" 
                className="w-32 h-auto mx-auto mb-3"
              />
              <h2 className="gold-gradient-text text-2xl font-bold">{currentShop.shopName}</h2>
              <p className="text-gray-400 text-sm">{currentShop.promoMessage}</p>
            </div>
          )}

          {/* Deactivated Shop Warning */}
          {currentShop && currentShop.isActive === false && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6 text-center">
              <p className="text-red-400 font-bold text-lg">
                {language === 'sw' ? 'DUKA LIMEZIMWA' : 'SHOP DEACTIVATED'}
              </p>
              <p className="text-red-300 text-sm mt-1">
                {language === 'sw' 
                  ? 'Duka hili limezimwa na msimamizi. Wasiliana na admin kupata msaada.'
                  : 'This shop has been deactivated by admin. Contact admin for help.'}
              </p>
            </div>
          )}

          {/* Test Mode Indicator - only shown for super_admin */}
          {isSuperAdminTestMode && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-6 text-center">
              <span className="text-red-400 font-bold">🔴 TEST MODE</span>
              <p className="text-red-300 text-xs mt-1">
                {language === 'sw' 
                  ? 'Data haichukuliwi kwa hesabu za kawaida'
                  : 'Test data isolated from real analytics'}
              </p>
            </div>
          )}

          {/* Demo Mode */}
          <button
            onClick={handleDemoMode}
            className="btn-gold-outline w-full mb-3 flex items-center justify-center gap-2"
          >
            <Zap size={20} />
            {t.demoMode}
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="btn-outline w-full mb-6 flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} />
            {language === 'sw' ? 'Fanya Upya' : 'New Session'}
          </button>

          {/* Auth Form */}
          <div className="card-gold">
            <h3 className="text-xl font-semibold text-center mb-4">
              {language === 'sw' ? 'Ingiza taarifa zako' : 'Enter Your Details'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t.enterPhone}</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="input"
                  placeholder="+254 700 000 000"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t.enterAmount}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  className="input"
                  placeholder="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t.qualifyingPurchase}: KSh {currentShop?.qualifyingPurchase || 0}
                </p>
              </div>

              <button
                onClick={handleAuthorize}
                disabled={isAuthorizing}
                className="btn-gold w-full flex items-center justify-center gap-2"
              >
                {isAuthorizing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-5 h-5 border-2 border-black border-t-transparent rounded-full"
                  />
                ) : (
                  <Gift size={20} />
                )}
                {t.authorize}
              </button>
            </div>
          </div>

          {/* Language Toggle */}
          <div className="flex justify-center mt-6">
            <button
              onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')}
              className="flex items-center gap-2 text-gray-400 hover:text-gold-400"
            >
              <Languages size={20} />
              {t.language}: {language === 'en' ? 'English' : 'Swahili'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Number picker modal - shows numbers 1 to (18-threshold) based on odds percentage
  if (showNumberPicker && !showResult) {
    const threshold = thresholdNumber || 1;
    const startNumber = 1;
    const endNumber = Math.max(1, 18 - threshold); // Ensure at least 1 number
    const availableNumbers = endNumber - startNumber + 1;
    
    // Guard: if no numbers available, go back
    if (availableNumbers <= 0) {
      setShowNumberPicker(false);
      return null;
    }
    
    return (
      <div className="min-h-screen p-4 flex flex-col overflow-auto">
        <div className="max-w-md mx-auto w-full">
          <h2 className="gold-gradient-text text-2xl font-bold text-center mb-2">
            {t.selectNumber}
          </h2>
          
          <p className="text-gray-400 text-center mb-4">
            {language === 'sw' 
              ? `Chagua nambari: ${startNumber} - ${endNumber}`
              : `Pick a number: ${startNumber} - ${endNumber}`}
          </p>
          
          <div className={`grid gap-2 sm:gap-3 ${
            availableNumbers <= 3 
              ? 'grid-cols-3' 
              : availableNumbers <= 6
                ? 'grid-cols-3 sm:grid-cols-6'
                : 'grid-cols-4 sm:grid-cols-5'
          }`}>
              {Array.from({ length: availableNumbers }, (_, i) => startNumber + i).map((num) => (
                <motion.button
                  key={num}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`game-box ${tappedNumber === num ? 'box-tapped' : ''}`}
                  onClick={() => handleNumberSelect(num)}
                >
                  {num}
                </motion.button>
              ))}
            </div>
        </div>
      </div>
    );
  }

  // Item picker - customer selects an item before picking number
  if (showItemPicker && !showResult && gameStatus === 'playing') {
    const activeItems = items.filter(i => i.isActive);
    
    // If no active items, skip to number picker
    if (activeItems.length === 0) {
      setShowItemPicker(false);
      setShowNumberPicker(true);
      return null;
    }
    
    return (
      <div className="min-h-screen p-4 flex flex-col overflow-auto">
        <div className="max-w-md mx-auto w-full">
          <h2 className="gold-gradient-text text-2xl font-bold text-center mb-2">
            {language === 'sw' ? 'Chagua Ombi lako' : 'Select Your Prize'}
          </h2>
          <p className="text-gray-400 text-center mb-4">
            {language === 'sw' 
              ? 'Chagua moja kati ya vilivyopo chini' 
              : 'Pick one of the prizes below'}
          </p>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {activeItems.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleItemSelect(item)}
                className={`game-box overflow-hidden p-0 flex flex-col justify-start ${
                  selectedItem?.id === item.id 
                    ? 'ring-2 ring-gold-500 bg-gold-900/50 selected' 
                    : ''
                } ${tappedItemId === item.id ? 'item-tapped' : ''}`}
              >
                <div className="w-full flex-1 min-h-0 relative">
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Gift className="w-8 h-8 text-gold-400" />
                    </div>
                  )}
                </div>
                <div className="w-full px-1 py-1 bg-black/60 text-center shrink-0">
                  <p className="text-xs font-semibold truncate leading-tight text-white">
                    {item.name}
                  </p>
                  <p className="text-xs leading-tight font-bold text-gold-400">
                    KSh {(item.value || 0).toLocaleString()}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Result screen
  if (showResult) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center overflow-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full text-center"
        >
          <AnimatePresence mode="wait">
            {gameWon ? (
              <motion.div
                key="win"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="card-gold"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="text-6xl mb-4"
                >
                  <Trophy className="w-20 h-20 mx-auto text-yellow-400" />
                </motion.div>
                
                <h2 className="gold-gradient-text text-3xl font-bold mb-2">
                  {t.youWon}
                </h2>
                
                {winningItem && (
                  <div className="my-6 p-4 bg-gold-900/30 rounded-lg">
                    <Sparkles className="w-8 h-8 mx-auto text-gold-400 mb-2" />
                    <p className="text-gray-400 text-sm">{language === 'sw' ? 'Umepata' : 'You won'}</p>
                    <p className="gold-gradient-text text-2xl font-bold">{winningItem.name}</p>
                    <p className="text-gold-400 text-xl">KSh {(winningItem.value || 0).toLocaleString()}</p>
                  </div>
                )}

                <button onClick={handleNominate} className="btn-gold w-full mb-3 flex items-center justify-center gap-2">
                  <Heart className="w-5 h-5" />
                  {t.nominate}
                </button>
                <button onClick={handleSkipNominate} className="text-gray-400 text-sm">
                  {t.skipNominate}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="lose"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="card"
              >
                <div className="text-6xl mb-4">😔</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {t.youLost}
                </h2>
                <p className="text-gray-400 mb-4">
                  {language === 'sw'
                    ? `Nambari: ${correctNumber}`
                    : `Number: ${correctNumber}`}
                </p>
                
                <button onClick={handleNominate} className="btn-gold w-full mb-3 flex items-center justify-center gap-2">
                  <Heart className="w-5 h-5" />
                  {t.nominate}
                </button>
                <button onClick={handleSkipNominate} className="text-gray-400 text-sm">
                  {t.skipNominate}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  // Main game screen - box selection
  return (
    <div className="min-h-screen p-4 overflow-auto">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setGameStatus('idle')}
            className="flex items-center gap-2 text-gray-400 hover:text-gold-400"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')}
              className="p-2 text-gray-400 hover:text-gold-400"
            >
              <Languages size={20} />
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-gray-400 hover:text-gold-400"
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        </div>

        <h2 className="gold-gradient-text text-2xl font-bold text-center mb-2">
          {t.selectBox}
        </h2>
        <p className="text-gray-400 text-center text-sm">
          {language === 'sw'
            ? `Umemchochewa na ${config.boxCount} sanduku - Cheza bahati yako!`
            : `You've been presented with ${config.boxCount} boxes - Try your luck!`}
        </p>
      </div>

      {/* Box Grid */}
      <div className="max-w-2xl mx-auto">
        <div className={`game-grid-${config.boxCount}`}>
          {Array.from({ length: config.boxCount }, (_, i) => i + 1).map((boxNum, index) => {
            // Get corresponding item from items array based on box number (boxNum 1 = index 0)
            const item = items.find(item => item.order === boxNum - 1);
            return (
              <motion.button
                key={boxNum}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`game-box ${selectedBox === boxNum ? 'selected' : ''} ${tappedBoxNum === boxNum ? 'box-tapped' : ''}`}
                onClick={() => handleBoxSelect(boxNum)}
              >
                {/* Item Image or Placeholder */}
                <div className="w-full flex flex-col items-center justify-center gap-1 px-1">
                  {item?.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="w-8 h-8 object-cover rounded"
                    />
                  ) : (
                    <Gift className={`w-6 h-6 ${tappedBoxNum === boxNum ? 'text-white' : ''}`} />
                  )}
                  {/* Item Name */}
                  <span className="text-xs font-semibold text-center leading-tight line-clamp-2">
                    {item?.name || `${t.box} ${boxNum}`}
                  </span>
                  {/* Item Price */}
                  {item?.value && (
                    <span className={`text-[10px] ${tappedBoxNum === boxNum ? 'text-white' : 'text-gold-400'}`}>
                      KSh {(item.value || 0).toLocaleString()}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Box count indicator */}
      <div className="max-w-2xl mx-auto mt-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold-900/30 rounded-full">
          <Star className="w-4 h-4 text-gold-400" />
          <span className="text-gold-400 text-sm">
            {config.ratio} - {config.boxCount} {language === 'sw' ? 'sanduku' : 'boxes'}
          </span>
        </div>
      </div>
    </div>
  );
}
