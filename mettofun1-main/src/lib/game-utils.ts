import CryptoJS from 'crypto-js';
import type { Item, GameAttempt, BoxConfiguration } from '@/types';

// Dynamic Odds Calculator - Fair Boost System
// Always 17 boxes, but winning threshold changes based on purchase
// Higher purchase = lower threshold = easier to win
export const calculateBoxConfiguration = (purchaseAmount: number, qualifyingAmount: number): BoxConfiguration => {
  // Guard against division by zero - if qualifying amount is 0, use default threshold
  if (qualifyingAmount <= 0) {
    return { boxCount: 17, threshold: 1, ratio: '0' };
  }
  
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

// Secure random number generation using Web Crypto API (CSPRNG)
export const generateSecureRandomNumber = (max: number): number => {
  if (max <= 0) return 1;
  
  // Use Web Crypto API for proper CSPRNG
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  
  // Convert to number in range 1 to max
  const result = (array[0] % max) + 1;
  
  return Math.min(Math.max(result, 1), max);
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
  // If no qualifying purchase set, allow any item value
  if (qualifyingPurchase <= 0) {
    return true;
  }
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
  
  // Default values ranging from 1000 to 17000 (realistic prize values)
  const defaultValues = [
    1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500,
    5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 17000
  ];
  
  return defaultNames.map((name, index) => ({
    id: `${shopId}-item-${index + 1}`,
    name,
    value: defaultValues[index] || (index + 1) * 1000,
    imageUrl: undefined,
    stockStatus: 'unlimited' as const,
    isActive: true,
    shopId,
    order: index
  }));
};

// Create a game attempt record with anti-tamper hash
/**
 * Validate game attempt parameters before creation
 * Returns true if valid, false if suspicious
 */
export const validateGameAttempt = (
  shopId: string,
  phoneNumber: string,
  purchaseAmount: number,
  qualifyingAmount: number,
  selectedBox: number,
  correctNumber: number,
  won: boolean,
  threshold?: number
): { valid: boolean; error?: string } => {
  // Check required fields
  if (!shopId || shopId.trim() === '') {
    return { valid: false, error: 'Missing shop ID' };
  }
  
  if (!phoneNumber || phoneNumber.trim().length < 7) {
    return { valid: false, error: 'Invalid phone number' };
  }
  
  if (typeof purchaseAmount !== 'number' || purchaseAmount < 0) {
    return { valid: false, error: 'Invalid purchase amount' };
  }
  
  if (typeof correctNumber !== 'number' || correctNumber < 1 || correctNumber > 18) {
    return { valid: false, error: 'Invalid winning number' };
  }
  
  if (typeof selectedBox !== 'number' || selectedBox < 0 || selectedBox > 6) {
    return { valid: false, error: 'Invalid selected box' };
  }
  
  // Verify win is mathematically possible based on threshold
  if (threshold !== undefined && won) {
    if (selectedBox > threshold) {
      return { valid: false, error: 'Win not possible with this threshold' };
    }
  }
  
  return { valid: true };
};

export const createGameAttempt = (
  shopId: string,
  phoneNumber: string,
  purchaseAmount: number,
  qualifyingAmount: number,
  selectedBox: number,
  correctNumber: number,
  won: boolean,
  selectedItem?: Item,
  isTest?: boolean,
  entrySource?: 'NPN' | 'PURCHASE',
  entryType?: 'NPN' | 'REGULAR'
): GameAttempt => {
  const timestamp = new Date();
  // Generate a random seed for this attempt (used in hash)
  const seed = CryptoJS.lib.WordArray.random(16).toString();
  
  // Generate integrity hash
  const integrityHash = generateGameAttemptHash(
    shopId,
    phoneNumber,
    purchaseAmount,
    qualifyingAmount,
    selectedBox,
    correctNumber,
    won,
    timestamp,
    seed
  );
  
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
    timestamp,
    synced: false,
    isTest: isTest || false,
    entrySource: entrySource || 'PURCHASE',
    entryType: entryType || 'REGULAR',
    integrityHash,
    integrityVerified: true, // Mark as verified since we just created it
    hashSeed: seed
  };
};

// Format phone number (basic validation)
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it
  const cleaned = digits.startsWith('0') ? digits.substring(1) : digits;
  
  // If doesn't have country code, add 254 (Kenya)
  return cleaned.startsWith('254') ? cleaned : `254${cleaned}`;
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
export const calculateShopAnalytics = (attempts: GameAttempt[], shopId: string = '') => {
  const totalAttempts = attempts.length;
  const totalWins = attempts.filter(a => a.won).length;
  const winRate = totalAttempts > 0 ? (totalWins / totalAttempts) * 100 : 0;
  
  // Count tampered attempts (failed integrity verification)
  const tamperedCount = attempts.filter(a => a.integrityVerified === false).length;
  
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
    shopId,
    totalAttempts,
    totalWins,
    winRate,
    tamperedCount,
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

// Generate anti-tamper hash for a game attempt
// This creates a hash of all game parameters to verify the result wasn't manipulated
export const generateGameAttemptHash = (
  shopId: string,
  phoneNumber: string,
  purchaseAmount: number,
  qualifyingAmount: number,
  selectedBox: number,
  correctNumber: number,
  won: boolean,
  timestamp: Date | string,
  seed: string
): string => {
  const data = {
    shopId,
    phoneNumber,
    purchaseAmount,
    qualifyingAmount,
    selectedBox,
    correctNumber,
    won,
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
    seed
  };
  return generateIntegrityHash(data);
};

// Verify game attempt integrity
export const verifyGameAttemptIntegrity = (
  attempt: {
    shopId: string;
    phoneNumber: string;
    purchaseAmount: number;
    qualifyingAmount: number;
    selectedBox: number;
    correctNumber: number;
    won: boolean;
    timestamp: Date | string;
    hashSeed?: string;
  },
  expectedHash: string
): boolean => {
  const actualHash = generateGameAttemptHash(
    attempt.shopId,
    attempt.phoneNumber,
    attempt.purchaseAmount,
    attempt.qualifyingAmount,
    attempt.selectedBox,
    attempt.correctNumber,
    attempt.won,
    attempt.timestamp,
    attempt.hashSeed || ''
  );
  return actualHash === expectedHash;
};
