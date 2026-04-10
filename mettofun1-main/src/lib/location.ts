// Location verification utilities

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if user is within the specified radius of a location
 * @returns true if user is within radius, false otherwise
 */
export function isWithinRadius(
  userLat: number,
  userLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(userLat, userLon, targetLat, targetLon);
  return distance <= radiusMeters;
}

/**
 * Get user's current GPS location
 * @returns Promise with location or error
 */
export function getUserLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        let errorMessage = 'Unknown error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Verify if user is at the authorized shop location
 * @param shopLocation - Shop's saved location (lat, lon, radius)
 * @returns Promise<{ isValid: boolean; distance?: number; error?: string }>
 */
export async function verifyShopLocation(
  shopLocation: { latitude: number; longitude: number; radiusMeters: number } | undefined
): Promise<{ isValid: boolean; distance?: number; error?: string }> {
  // If shop doesn't have location set up, allow play (backward compatibility)
  if (!shopLocation || !shopLocation.latitude || !shopLocation.longitude) {
    return { isValid: true };
  }

  try {
    const userLocation = await getUserLocation();
    
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      shopLocation.latitude,
      shopLocation.longitude
    );

    const isValid = distance <= shopLocation.radiusMeters;

    return {
      isValid,
      distance: Math.round(distance),
      error: isValid ? undefined : `You must be within ${shopLocation.radiusMeters}m of the shop to play`
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify location'
    };
  }
}
