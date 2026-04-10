import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateBoxConfiguration,
  generateSecureRandomNumber,
  hashNumber,
  verifyHash,
  getWinningItem,
  validateItemPrice,
  generateDefaultItems,
  createGameAttempt,
  formatPhoneNumber,
  isValidPhoneNumber,
  getCurrentDateString,
  calculateShopAnalytics,
  encryptData,
  decryptData,
  generateIntegrityHash,
  verifyIntegrity,
} from './game-utils';

describe('calculateBoxConfiguration', () => {
  it('should return default threshold when qualifyingAmount is 0', () => {
    const result = calculateBoxConfiguration(1000, 0);
    expect(result.boxCount).toBe(17);
    expect(result.threshold).toBe(1);
    expect(result.ratio).toBe('0');
  });

  it('should return default threshold when qualifyingAmount is negative', () => {
    const result = calculateBoxConfiguration(1000, -100);
    expect(result.boxCount).toBe(17);
    expect(result.threshold).toBe(1);
  });

  it('should return threshold 1 when ratio is less than 150', () => {
    const result = calculateBoxConfiguration(1000, 10000);
    expect(result.threshold).toBe(1);
    expect(result.ratio).toBe('10');
  });

  it('should return threshold 2 when ratio is between 150-200', () => {
    const result = calculateBoxConfiguration(16000, 10000);
    expect(result.threshold).toBe(2);
    expect(result.ratio).toBe('160');
  });

  it('should return threshold 3 when ratio is between 200-300', () => {
    const result = calculateBoxConfiguration(25000, 10000);
    expect(result.threshold).toBe(3);
  });

  it('should return threshold 4 when ratio is between 300-400', () => {
    const result = calculateBoxConfiguration(35000, 10000);
    expect(result.threshold).toBe(4);
  });

  it('should return threshold 5 when ratio is between 400-500', () => {
    const result = calculateBoxConfiguration(45000, 10000);
    expect(result.threshold).toBe(5);
  });

  it('should return threshold 6 when ratio is 500 or higher', () => {
    const result = calculateBoxConfiguration(60000, 10000);
    expect(result.threshold).toBe(6);
  });
});

describe('generateSecureRandomNumber', () => {
  it('should generate a number between 1 and max', () => {
    const result = generateSecureRandomNumber(17);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(17);
  });

  it('should generate different numbers on different calls', () => {
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(generateSecureRandomNumber(17));
    }
    // Should have multiple unique values
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('hashNumber and verifyHash', () => {
  it('should hash a number correctly', () => {
    const hash = hashNumber(5, 'secret');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should verify a correct hash', () => {
    const hash = hashNumber(5, 'secret');
    const isValid = verifyHash(5, hash, 'secret');
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect hash', () => {
    const hash = hashNumber(5, 'secret');
    const isValid = verifyHash(10, hash, 'secret');
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for different secrets', () => {
    const hash1 = hashNumber(5, 'secret1');
    const hash2 = hashNumber(5, 'secret2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('getWinningItem', () => {
  const mockItems = [
    { id: '1', name: 'Item 1', value: 1000, isActive: true } as any,
    { id: '2', name: 'Item 2', value: 2000, isActive: true } as any,
    { id: '3', name: 'Item 3', value: 3000, isActive: false } as any,
  ];

  it('should return null when items array is empty', () => {
    const result = getWinningItem(1, []);
    expect(result).toBeNull();
  });

  it('should return null when all items are inactive', () => {
    const inactiveItems = [
      { id: '1', name: 'Item 1', value: 1000, isActive: false } as any,
    ];
    const result = getWinningItem(1, inactiveItems);
    expect(result).toBeNull();
  });

  it('should return active item based on random number', () => {
    const result = getWinningItem(1, mockItems);
    expect(result).not.toBeNull();
    expect(result?.isActive).toBe(true);
  });

  it('should cycle through items when random number exceeds item count', () => {
    const result = getWinningItem(5, mockItems);
    expect(result).not.toBeNull();
  });
});

describe('validateItemPrice', () => {
  it('should return true when qualifyingPurchase is 0', () => {
    const result = validateItemPrice(10000, 0);
    expect(result).toBe(true);
  });

  it('should return true when qualifyingPurchase is negative', () => {
    const result = validateItemPrice(10000, -100);
    expect(result).toBe(true);
  });

  it('should return true when item value is 60% or less of qualifying purchase', () => {
    const result = validateItemPrice(6000, 10000);
    expect(result).toBe(true);
  });

  it('should return false when item value exceeds 60% of qualifying purchase', () => {
    const result = validateItemPrice(7000, 10000);
    expect(result).toBe(false);
  });

  it('should return true when item value equals exactly 60%', () => {
    const result = validateItemPrice(6000, 10000);
    expect(result).toBe(true);
  });
});

describe('generateDefaultItems', () => {
  it('should generate 17 items', () => {
    const items = generateDefaultItems('shop1');
    expect(items.length).toBe(17);
  });

  it('should have realistic prize values', () => {
    const items = generateDefaultItems('shop1');
    const values = items.map(i => i.value);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...values)).toBeLessThanOrEqual(20000);
  });

  it('should set all items as active', () => {
    const items = generateDefaultItems('shop1');
    items.forEach(item => {
      expect(item.isActive).toBe(true);
    });
  });

  it('should have unique IDs', () => {
    const items = generateDefaultItems('shop1');
    const ids = items.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(17);
  });
});

describe('createGameAttempt', () => {
  it('should create a game attempt with required fields', () => {
    const attempt = createGameAttempt(
      'shop1',
      '254123456789',
      15000,
      10000,
      5,
      5,
      true,
      undefined,
      false
    );

    expect(attempt.shopId).toBe('shop1');
    expect(attempt.phoneNumber).toBe('254123456789');
    expect(attempt.purchaseAmount).toBe(15000);
    expect(attempt.qualifyingAmount).toBe(10000);
    expect(attempt.selectedBox).toBe(5);
    expect(attempt.correctNumber).toBe(5);
    expect(attempt.won).toBe(true);
    expect(attempt.synced).toBe(false);
    expect(attempt.isTest).toBe(false);
    expect(attempt.id).toBeTruthy();
  });

  it('should handle test flag', () => {
    const attempt = createGameAttempt(
      'shop1',
      '254123456789',
      15000,
      10000,
      5,
      3,
      false,
      undefined,
      true
    );
    expect(attempt.isTest).toBe(true);
  });

  it('should include selected item when provided', () => {
    const item = { id: '1', name: 'Prize', value: 5000, isActive: true } as any;
    const attempt = createGameAttempt(
      'shop1',
      '254123456789',
      15000,
      10000,
      5,
      5,
      true,
      item,
      false
    );
    expect(attempt.selectedItem).toEqual(item);
  });
});

describe('formatPhoneNumber', () => {
  it('should remove leading zero and add country code', () => {
    const result = formatPhoneNumber('0712345678');
    expect(result).toBe('254712345678');
  });

  it('should add country code if not present', () => {
    const result = formatPhoneNumber('712345678');
    expect(result).toBe('254712345678');
  });

  it('should keep country code if already present', () => {
    const result = formatPhoneNumber('254712345678');
    expect(result).toBe('254712345678');
  });

  it('should remove non-digit characters', () => {
    const result = formatPhoneNumber('+254-712-345-678');
    expect(result).toBe('254712345678');
  });
});

describe('isValidPhoneNumber', () => {
  it('should return true for valid phone numbers', () => {
    expect(isValidPhoneNumber('254712345678')).toBe(true);
    expect(isValidPhoneNumber('712345678')).toBe(true);
    expect(isValidPhoneNumber('123456789')).toBe(true);
  });

  it('should return false for invalid phone numbers', () => {
    expect(isValidPhoneNumber('12345678')).toBe(false); // Too short
    expect(isValidPhoneNumber('')).toBe(false);
    expect(isValidPhoneNumber('abc')).toBe(false);
  });
});

describe('getCurrentDateString', () => {
  it('should return date in YYYY-MM-DD format', () => {
    const result = getCurrentDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('calculateShopAnalytics', () => {
  const mockAttempts = [
    {
      id: '1',
      shopId: 'shop1',
      phoneNumber: '254123456789',
      purchaseAmount: 10000,
      qualifyingAmount: 10000,
      selectedBox: 1,
      correctNumber: 1,
      won: true,
      selectedItem: { id: 'item1', name: 'Prize', value: 5000, isActive: true, stockStatus: 'unlimited' as const, shopId: 'shop1', order: 1 },
      timestamp: new Date('2024-01-15T10:00:00'),
      synced: false,
      isTest: false,
    },
    {
      id: '2',
      shopId: 'shop1',
      phoneNumber: '254987654321',
      purchaseAmount: 15000,
      qualifyingAmount: 10000,
      selectedBox: 2,
      correctNumber: 5,
      won: false,
      selectedItem: undefined,
      timestamp: new Date('2024-01-15T11:00:00'),
      synced: false,
      isTest: false,
    },
  ];

  it('should calculate total attempts', () => {
    const analytics = calculateShopAnalytics(mockAttempts);
    expect(analytics.totalAttempts).toBe(2);
  });

  it('should calculate win rate correctly', () => {
    const analytics = calculateShopAnalytics(mockAttempts);
    expect(analytics.totalWins).toBe(1);
    expect(analytics.winRate).toBe(50);
  });

  it('should handle empty attempts array', () => {
    const analytics = calculateShopAnalytics([]);
    expect(analytics.totalAttempts).toBe(0);
    expect(analytics.totalWins).toBe(0);
    expect(analytics.winRate).toBe(0);
  });

  it('should track most selected items', () => {
    const analytics = calculateShopAnalytics(mockAttempts);
    expect(analytics.mostSelectedItems.length).toBeGreaterThan(0);
  });
});

describe('encryptData and decryptData', () => {
  it('should encrypt and decrypt data correctly', () => {
    const original = { name: 'test', value: 123 };
    const encrypted = encryptData(original);
    const decrypted = decryptData(encrypted);
    expect(decrypted).toEqual(original);
  });

  it('should return null for invalid ciphertext', () => {
    const result = decryptData('invalid-data');
    expect(result).toBeNull();
  });
});

describe('generateIntegrityHash and verifyIntegrity', () => {
  it('should generate a hash for data', () => {
    const hash = generateIntegrityHash({ test: 'data' });
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });

  it('should verify correct data', () => {
    const data = { test: 'data' };
    const hash = generateIntegrityHash(data);
    const isValid = verifyIntegrity(data, hash);
    expect(isValid).toBe(true);
  });

  it('should reject modified data', () => {
    const data = { test: 'data' };
    const hash = generateIntegrityHash(data);
    const modifiedData = { test: 'modified' };
    const isValid = verifyIntegrity(modifiedData, hash);
    expect(isValid).toBe(false);
  });
});
