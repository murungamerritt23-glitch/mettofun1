import CryptoJS from 'crypto-js';
import type { Item, GameAttempt, BoxConfiguration } from '@/types';

// Dynamic Odds Calculator - Fair Boost System
// Always 17 boxes, but winning threshold changes based on purchase
// Higher purchase = lower threshold = easier to win
export const calculateBoxConfiguration = (purchaseAmount: number, qualifyingAmount: number): BoxConfiguration => {
  const ratio = (purchaseAmount / qualifyingAmount) * 100;
  
  // Threshold determines winning probability (lower = easier to win)
  // With 17 boxes:
  // - threshold 1: 1/17 = 5.9% win rate
  // - threshold 2: 2/17 = 11.8% win rate
  // - threshold 3: 3/17 = 17.6% win rate
  // etc.
  let threshold: number;
  
  if (ratio < 150) {
    threshold = 1;  // Hardest - only 1 winning number out of 17
  } else if (ratio < 200) {
    threshold = 2;  // 2 winning numbers
  } else if (ratio < 300) {
    threshold = 3;  // 3 winning numbers
  } else if (ratio < 400) {
    threshold = 4;  // 4 winning numbers
  } else if (ratio < 500) {
    threshold = 5;  // 5 winning numbers
  } else {
    threshold = 6;  // Easiest - 6 winning numbers out of 17
  }
  
  return { boxCount: 17, threshold, ratio: ratio.toString() };
};

// Secure random number generation with obfuscation
export const generateSecureRandomNumber = (max: number): number => {
  // Generate entropy from multiple sources
  const timestamp = Date.now();
  const randomBytes = CryptoJS.lib.WordArray.random(4);
  const entropy = `${timestamp}-${randomBytes}-${Math.random()}`;
  
  // Hash the entropy
  const hash = CryptoJS.SHA256(entropy);
  
  // Convert to number and mod by max
  const num = parseInt(hash.toString(CryptoJS.enc.Hex).substring(0, 8), 16);
  return (num % max) + 1;
};

// Hash a number for anti-cheat
export const hashNumber = (number: number, secret: string): string => {
  return CryptoJS.HmacSHA256(number.toString(), secret).toString();
};

// Verify a hashed number (for server-side validation)
export const verifyHash = (number: number, hash: string, secret: string): boolean => {
  const expectedHash = hashNumber(number, secret);
  return expectedHash === hash;
};

// Get winning item based on random number
export const getWinningItem = (randomNumber: number, items: Item[]): Item | null => {
  // Only consider active items
  const activeItems = items.filter(item => item.isActive);
  if (activeItems.length === 0) return null;
  
  // Map number to item index
  const index = (randomNumber - 1) % activeItems.length;
  return activeItems[index];
};

// Validate item price against qualifying purchase (60% rule)
export const validateItemPrice = (itemValue: number, qualifyingPurchase: number): boolean => {
  return itemValue <= qualifyingPurchase * 0.6;
};

// Generate 17 default items for a new shop
export const generateDefaultItems = (shopId: string): Item[] => {
  const defaultNames = [
    'Mystery Box', 'Gift Card', 'Discount Voucher', 'Free Product', 
    'Bonus Points', 'Cash Prize', 'Coupon', 'Mystery Prize',
    'Special Offer', 'Lucky Draw', 'Reward Points', 'Mystery Gift',
    'Prize Pack', 'Surprise Item', 'Bonus Gift', 'Mystery Reward', 'Grand Prize'
  ];
  
  return defaultNames.map((name, index) => ({
    id: `${shopId}-item-${index + 1}`,
    name,
    value: 0,
    imageUrl: undefined,
    stockStatus: 'unlimited' as const,
    isActive: true,
    shopId,
    order: index
  }));
};

// Create a game attempt record
export const createGameAttempt = (
  shopId: string,
  phoneNumber: string,
  purchaseAmount: number,
  qualifyingAmount: number,
  selectedBox: number,
  correctNumber: number,
  won: boolean,
  selectedItem?: Item,
  isTest?: boolean
): GameAttempt => {
  return {
    id: crypto.randomUUID(),
    shopId,
    phoneNumber,
    purchaseAmount,
    qualifyingAmount,
    selectedBox,
    correctNumber,
    won,
    selectedItem,
    timestamp: new Date(),
    synced: false,
    isTest: isTest || false
  };
};

// Format phone number (basic validation)
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it
  const cleaned = digits.startsWith('0') ? digits.substring(1) : digits;
  
  // If doesn't have country code, add 255 (Tanzania)
  return cleaned.startsWith('255') ? cleaned : `255${cleaned}`;
};

// Validate phone number format
export const isValidPhoneNumber = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
};

// Get current date string (for daily reset)
export const getCurrentDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Calculate analytics from attempts
export const calculateShopAnalytics = (attempts: GameAttempt[]) => {
  const totalAttempts = attempts.length;
  const totalWins = attempts.filter(a => a.won).length;
  const winRate = totalAttempts > 0 ? (totalWins / totalAttempts) * 100 : 0;
  
  // Most selected items
  const itemCounts: Record<string, number> = {};
  attempts.forEach(attempt => {
    if (attempt.selectedItem) {
      const itemId = attempt.selectedItem.id;
      itemCounts[itemId] = (itemCounts[itemId] || 0) + 1;
    }
  });
  const mostSelectedItems = Object.entries(itemCounts)
    .map(([itemId, count]) => ({ itemId, count }))
    .sort((a, b) => b.count - a.count);
  
  // Hourly engagement
  const hourlyData: Record<number, number> = {};
  attempts.forEach(attempt => {
    const hour = new Date(attempt.timestamp).getHours();
    hourlyData[hour] = (hourlyData[hour] || 0) + 1;
  });
  const hourlyEngagement = Object.entries(hourlyData)
    .map(([hour, attempts]) => ({ hour: parseInt(hour), attempts }))
    .sort((a, b) => a.hour - b.hour);
  
  // Daily attempts
  const dailyData: Record<string, { attempts: number; wins: number }> = {};
  attempts.forEach(attempt => {
    const date = new Date(attempt.timestamp).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { attempts: 0, wins: 0 };
    }
    dailyData[date].attempts++;
    if (attempt.won) dailyData[date].wins++;
  });
  const dailyAttempts = Object.entries(dailyData)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    totalAttempts,
    totalWins,
    winRate,
    mostSelectedItems,
    hourlyEngagement,
    dailyAttempts
  };
};

// Local storage encryption helpers
const ENCRYPTION_KEY = 'metofun-local-key';

export const encryptData = (data: any): string => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
};

export const decryptData = (ciphertext: string): any => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
};

// Anti-tampering check
export const generateIntegrityHash = (data: any): string => {
  return CryptoJS.SHA256(JSON.stringify(data)).toString();
};

export const verifyIntegrity = (data: any, expectedHash: string): boolean => {
  const actualHash = generateIntegrityHash(data);
  return actualHash === expectedHash;
};
