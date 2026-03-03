import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

export const dynamic = 'force-static';

/**
 * Game result validation API endpoint
 * Provides server-side verification for game results
 * 
 * This adds a layer of anti-cheat by validating results on the server
 * In production, this would connect to Firebase for proper verification
 */

// Secret key for HMAC validation (must be set via environment variable in production)
const VALIDATION_SECRET = process.env.GAME_VALIDATION_SECRET;

// Check if running in production without proper configuration
if (typeof window === 'undefined' && !VALIDATION_SECRET) {
  console.warn('⚠️ SECURITY: GAME_VALIDATION_SECRET not set! Set in production!');
}

/**
 * Validate a game result
 * POST /api/validate-game
 * Body: { shopId, purchaseAmount, qualifyingAmount, selectedBox, correctNumber, won, timestamp }
 */
export async function POST(request: NextRequest) {
  // In production, require a valid API key or authentication
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.VALIDATION_API_KEY;
  
  // If API key is configured, validate it
  if (expectedApiKey && apiKey !== expectedApiKey) {
    return NextResponse.json(
      { valid: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { shopId, purchaseAmount, qualifyingAmount, selectedBox, correctNumber, won, timestamp } = body;

    // Validate required fields
    if (!shopId || purchaseAmount === undefined || !qualifyingAmount || !selectedBox || !correctNumber) {
      return NextResponse.json(
        { valid: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (typeof purchaseAmount !== 'number' || typeof qualifyingAmount !== 'number' || 
        typeof selectedBox !== 'number' || typeof correctNumber !== 'number') {
      return NextResponse.json(
        { valid: false, error: 'Invalid field types' },
        { status: 400 }
      );
    }

    // Validate range
    if (purchaseAmount < 0 || qualifyingAmount <= 0 || selectedBox < 1 || selectedBox > 6) {
      return NextResponse.json(
        { valid: false, error: 'Invalid values' },
        { status: 400 }
      );
    }

    // Validate timestamp (not older than 5 minutes)
    const requestTime = Date.now();
    if (timestamp && (requestTime - timestamp > 5 * 60 * 1000)) {
      return NextResponse.json(
        { valid: false, error: 'Request expired' },
        { status: 400 }
      );
    }

    // Calculate expected threshold based on purchase ratio
    const ratio = (purchaseAmount / qualifyingAmount) * 100;
    let expectedThreshold: number;
    
    if (ratio < 150) {
      expectedThreshold = 1;
    } else if (ratio < 200) {
      expectedThreshold = 2;
    } else if (ratio < 300) {
      expectedThreshold = 3;
    } else if (ratio < 400) {
      expectedThreshold = 4;
    } else if (ratio < 500) {
      expectedThreshold = 5;
    } else {
      expectedThreshold = 6;
    }

    // Check if won correctly
    const expectedWin = selectedBox <= expectedThreshold;
    if (won !== expectedWin) {
      // Log potential cheating
      console.error('[ANTI-CHEAT] Mismatch between won status and threshold:', {
        shopId,
        selectedBox,
        expectedThreshold,
        won,
        expectedWin,
        timestamp
      });
      
      return NextResponse.json({
        valid: false,
        error: 'Game result does not match expected threshold',
        expectedThreshold,
        expectedWin
      });
    }

    // Generate validation hash for audit trail (only if secret is configured)
    let validationHash = '';
    if (VALIDATION_SECRET) {
      const validationData = `${shopId}-${purchaseAmount}-${qualifyingAmount}-${selectedBox}-${correctNumber}-${timestamp}`;
      validationHash = CryptoJS.HmacSHA256(validationData, VALIDATION_SECRET).toString();
    }

    return NextResponse.json({
      valid: true,
      threshold: expectedThreshold,
      validationHash,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[VALIDATION ERROR]', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Health check for the validation endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'game-validation',
    version: '1.0.0'
  });
}
