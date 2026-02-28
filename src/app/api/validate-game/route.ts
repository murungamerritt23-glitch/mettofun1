import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

/**
 * Game result validation API endpoint
 * Provides server-side verification for game results
 * 
 * This adds a layer of anti-cheat by validating results on the server
 * In production, this would connect to Firebase for proper verification
 */

// Secret key for HMAC validation (in production, use environment variable)
const VALIDATION_SECRET = process.env.GAME_VALIDATION_SECRET || 'metofun-default-secret';

/**
 * Validate a game result
 * POST /api/validate-game
 * Body: { shopId, purchaseAmount, qualifyingAmount, selectedBox, correctNumber, won, timestamp }
 */
export async function POST(request: NextRequest) {
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

    // Generate validation hash for audit trail
    const validationData = `${shopId}-${purchaseAmount}-${qualifyingAmount}-${selectedBox}-${correctNumber}-${timestamp}`;
    const validationHash = CryptoJS.HmacSHA256(validationData, VALIDATION_SECRET).toString();

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
