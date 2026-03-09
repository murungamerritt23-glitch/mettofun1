// Vitest setup file
import { vi } from 'vitest';

// Mock window for jsdom
global.window = global.window || {};
global.navigator = global.navigator || {};

// Mock IndexedDB
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};
global.indexedDB = indexedDB as any;
