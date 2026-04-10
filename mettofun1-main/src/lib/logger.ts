/**
 * Simple error logging utility for production debugging
 * In production, errors are logged to console and could be sent to a service like Sentry
 */

type ErrorLevel = 'error' | 'warning' | 'info';

interface LogEntry {
  level: ErrorLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Log an error with context
 */
export function logError(message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level: 'error',
    message,
    timestamp: Date.now(),
    context,
  };

  // Always log errors
  console.error('[METOFUN ERROR]', entry);

  // In production, you could send to Sentry or other monitoring service:
  // if (isProduction) { Sentry.captureException(new Error(message), { extra: context }); }
}

/**
 * Log a warning
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level: 'warning',
    message,
    timestamp: Date.now(),
    context,
  };

  console.warn('[METOFUN WARNING]', entry);
}

/**
 * Log info in development only
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  if (!isProduction) {
    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: Date.now(),
      context,
    };
    console.log('[METOFUN INFO]', entry);
  }
}

/**
 * Wrapper for try-catch to automatically log errors
 */
export function withErrorLogging<T>(
  fn: () => T,
  operationName: string
): T | undefined {
  try {
    return fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed: ${operationName}`, { error: message });
    return undefined;
  }
}

/**
 * Async wrapper for try-catch to automatically log errors
 */
export async function withErrorLoggingAsync<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed: ${operationName}`, { error: message });
    return undefined;
  }
}
