// Device identification utilities

const DEVICE_ID_KEY = 'metofun_device_id';

/**
 * Get or generate a unique device identifier
 * This ID is stored in localStorage and persists for this browser/device
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }
  
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a new UUID
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

/**
 * Get device info for display
 */
export function getDeviceInfo(): string {
  const deviceId = getDeviceId();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  
  return `Device ID: ${deviceId.substring(0, 8)}... | ${userAgent.substring(0, 50)}`;
}

/**
 * Check if current device is authorized for a shop
 * @param shopDeviceId - The device ID registered for the shop
 * @param deviceLocked - Whether device locking is enabled for the shop
 * @returns true if device is authorized or device locking is disabled
 */
export function isDeviceAuthorized(
  shopDeviceId: string | undefined, 
  deviceLocked: boolean | undefined
): boolean {
  // If device locking is not enabled, allow all devices
  if (!deviceLocked) {
    return true;
  }
  
  // If device locking is enabled but no device ID is set, deny
  if (!shopDeviceId) {
    return false;
  }
  
  // Check if current device matches the registered device
  const currentDeviceId = getDeviceId();
  return currentDeviceId === shopDeviceId;
}

/**
 * Register current device for a shop (for admin use)
 * @returns The device ID that will be registered
 */
export function registerCurrentDevice(): string {
  return getDeviceId();
}
