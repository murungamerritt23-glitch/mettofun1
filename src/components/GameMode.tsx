'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gift, ArrowLeft, Volume2, VolumeX, RefreshCw, 
  Check, X, Star, Zap, Trophy, Sparkles, Languages
} from 'lucide-react';
import { useGameStore, useShopStore, useItemStore, useUIStore } from '@/store';
import { localItems, localAttempts } from '@/lib/local-db';
import { 
  calculateBoxConfiguration, 
  generateSecureRandomNumber,
  getWinningItem,
  createGameAttempt,
  getCurrentDateString,
  isValidPhoneNumber,
  formatPhoneNumber
} from '@/lib/game-utils';
import type { Item, GameAttempt } from '@/types';

export default function GameMode() {
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [showNumberPicker, setShowNumberPicker] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [winningItem, setWinningItem] = useState<Item | null>(null);
  const [todayAttempts, setTodayAttempts] = useState(0);

  const { 
    gameStatus, setGameStatus, 
    selectedBox, setSelectedBox,
    correctNumber, setCorrectNumber,
    customerSession, setCustomerSession,
    selectedItem, setSelectedItem,
    isDemoMode, setDemoMode,
    language, setLanguage,
    resetGame 
  } = useGameStore();
  
  const { currentShop } = useShopStore();
  const { items, setItems } = useItemStore();
  const { setCurrentView } = useUIStore();

  // Load shop items
  useEffect(() => {
    const loadItems = async () => {
      if (currentShop) {
        const shopItems = await localItems.getByShop(currentShop.id);
        if (shopItems.length > 0) {
          setItems(shopItems);
        } else {
          // Generate default items if none exist
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
          await localItems.saveMultiple(defaultItems);
        }
      }
      setIsLoading(false);
    };
    loadItems();
  }, [currentShop, setItems]);

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
    if (!isValidPhoneNumber(phoneNumber)) {
      alert(language === 'sw' ? 'Nambari ya simu si sahihi' : 'Invalid phone number');
      return;
    }
    
    const amount = parseFloat(purchaseAmount);
    if (isNaN(amount) || amount < (currentShop?.qualifyingPurchase || 0)) {
      alert(language === 'sw' 
        ? `Kiwango cha chini ni TSh ${currentShop?.qualifyingPurchase || 0}`
        : `Minimum amount is TSh ${currentShop?.qualifyingPurchase || 0}`);
      return;
    }

    setIsAuthorizing(true);
    
    // Simulate authorization
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const config = calculateBoxConfiguration(amount, currentShop?.qualifyingPurchase || 10000);
    
    setCustomerSession({
      phoneNumber: formattedPhone,
      attemptsToday: 0,
      lastAttemptDate: getCurrentDateString(),
      authorized: true,
      purchaseAmount: amount
    });
    
    // Generate winning number (stored in memory only - not displayed)
    const winningNum = generateSecureRandomNumber(config.boxCount);
    setCorrectNumber(winningNum);
    
    setGameStatus('playing');
    setIsAuthorizing(false);
  };

  const handleBoxSelect = (boxIndex: number) => {
    if (gameStatus !== 'playing' || selectedBox !== null) return;
    
    setSelectedBox(boxIndex);
    setShowNumberPicker(true);
  };

  const handleNumberSelect = (number: number) => {
    if (selectedNumber !== null || !correctNumber) return;
    
    setSelectedNumber(number);
    
    // Check if won
    const won = number === correctNumber;
    setGameWon(won);
    
    if (won) {
      const item = getWinningItem(correctNumber, items.filter(i => i.isActive));
      setWinningItem(item);
      setSelectedItem(item || null);
    }
    
    // Save attempt
    const attempt = createGameAttempt(
      currentShop?.id || 'demo',
      customerSession?.phoneNumber || phoneNumber,
      parseFloat(purchaseAmount),
      currentShop?.qualifyingPurchase || 10000,
      selectedBox || 0,
      correctNumber,
      won,
      winningItem || undefined
    );
    
    localAttempts.save(attempt);
    
    setShowResult(true);
    setGameStatus(won ? 'won' : 'lost');
  };

  const handlePlayAgain = () => {
    // Generate new winning number
    const config = calculateBoxConfiguration(
      parseFloat(purchaseAmount), 
      currentShop?.qualifyingPurchase || 10000
    );
    const newWinningNum = generateSecureRandomNumber(config.boxCount);
    setCorrectNumber(newWinningNum);
    
    // Reset game state
    setSelectedBox(null);
    setSelectedNumber(null);
    setShowResult(false);
    setShowNumberPicker(false);
    setGameStatus('playing');
    setWinningItem(null);
    setSelectedItem(null);
  };

  const handleExit = () => {
    resetGame();
    setCurrentView('shop-select');
  };

  const handleDemoMode = () => {
    setDemoMode(true);
    setPhoneNumber('255700000000');
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
    ? calculateBoxConfiguration(customerSession.purchaseAmount, currentShop?.qualifyingPurchase || 10000)
    : { boxCount: 17, ratio: '<150%' };

  const translations = {
    en: {
      title: 'MetoFun',
      subtitle: 'Win Amazing Rewards!',
      qualifyingPurchase: 'Qualifying Purchase',
      enterPhone: 'Enter Phone Number',
      enterAmount: 'Purchase Amount (TSh)',
      authorize: 'Start Game',
      demoMode: 'Demo Mode',
      selectBox: 'Select a Box',
      selectNumber: 'Pick Your Lucky Number',
      youWon: '🎉 Congratulations!',
      youLost: '😔 Better Luck Next Time!',
      playAgain: 'Play Again',
      exit: 'Exit',
      language: 'Language',
      box: 'Box'
    },
    sw: {
      title: 'MetoFun',
      subtitle: 'Shinda Ajira Za Kushangaza!',
      qualifyingPurchase: 'Manunuzi Yanayokubali',
      enterPhone: 'Weka Nambari ya Simu',
      enterAmount: 'Kiwango cha Manunuzi (TSh)',
      authorize: 'Anza Kucheza',
      demoMode: 'Hali ya Demo',
      selectBox: 'Chagua Sanduku',
      selectNumber: 'Chagua Nambari yako',
      youWon: '🎉 Hongera!',
      youLost: '😔 Wawezekana Next Time!',
      playAgain: 'Cheza Tena',
      exit: 'Toka',
      language: 'Lugha',
      box: 'Sanduku'
    }
  };

  const t = translations[language];

  // Game not started - show authorization form
  if (gameStatus === 'idle') {
    return (
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="max-w-md mx-auto mb-6">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-gray-400 hover:text-gold-400 mb-4"
          >
            <ArrowLeft size={20} />
            {language === 'sw' ? 'Rudi' : 'Back'}
          </button>

          {/* Shop Info */}
          {currentShop && (
            <div className="card text-center mb-6">
              <h2 className="gold-gradient-text text-2xl font-bold">{currentShop.shopName}</h2>
              <p className="text-gray-400 text-sm">{currentShop.promoMessage}</p>
            </div>
          )}

          {/* Demo Mode */}
          <button
            onClick={handleDemoMode}
            className="btn-gold-outline w-full mb-6 flex items-center justify-center gap-2"
          >
            <Zap size={20} />
            {t.demoMode}
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
                  placeholder="+255 700 000 000"
                  disabled={isDemoMode}
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  {t.enterAmount}
                </label>
                <input
                  type="number"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  className="input"
                  placeholder="10000"
                  disabled={isDemoMode}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t.qualifyingPurchase}: TSh {currentShop?.qualifyingPurchase || 10000}
                </p>
              </div>

              <button
                onClick={handleAuthorize}
                disabled={isAuthorizing || isDemoMode}
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

  // Number picker modal
  if (showNumberPicker && !showResult) {
    return (
      <div className="min-h-screen p-4 flex flex-col">
        <div className="max-w-md mx-auto w-full">
          <h2 className="gold-gradient-text text-2xl font-bold text-center mb-2">
            {t.selectNumber}
          </h2>
          <p className="text-gray-400 text-center mb-6">
            {language === 'sw' 
              ? `Chagua nambari kati ya 1 na ${config.boxCount}`
              : `Pick a number between 1 and ${config.boxCount}`}
          </p>

          <div className={`grid gap-3 ${
            config.boxCount <= 12 ? 'grid-cols-3' : 
            config.boxCount <= 15 ? 'grid-cols-4' : 'grid-cols-5'
          }`}>
            {Array.from({ length: config.boxCount }, (_, i) => i + 1).map((num) => (
              <motion.button
                key={num}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="game-box"
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

  // Result screen
  if (showResult) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
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
                    <p className="text-gold-400 text-xl">TSh {winningItem.value.toLocaleString()}</p>
                  </div>
                )}

                <button onClick={handlePlayAgain} className="btn-gold w-full">
                  {t.playAgain}
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
                    ? `Nambari sahihi ilikuwa ${correctNumber}`
                    : `The correct number was ${correctNumber}`}
                </p>
                
                <button onClick={handlePlayAgain} className="btn-gold-outline w-full mb-3">
                  {t.playAgain}
                </button>
                <button onClick={handleExit} className="text-gray-400 text-sm">
                  {t.exit}
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
    <div className="min-h-screen p-4">
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
          {Array.from({ length: config.boxCount }, (_, i) => i + 1).map((boxNum, index) => (
            <motion.button
              key={boxNum}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`game-box ${selectedBox === boxNum ? 'selected' : ''}`}
              onClick={() => handleBoxSelect(boxNum)}
            >
              <Gift className="w-8 h-8" />
              <span className="text-sm mt-1">{t.box} {boxNum}</span>
            </motion.button>
          ))}
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
