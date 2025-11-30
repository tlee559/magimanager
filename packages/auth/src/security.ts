import crypto from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual which provides consistent execution time
 * regardless of where strings differ.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');

  // If lengths differ, still perform a comparison to maintain constant time
  if (aBuffer.length !== bBuffer.length) {
    // Compare with self to maintain constant time execution
    crypto.timingSafeEqual(aBuffer, aBuffer);
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Validates a cron request authorization header using timing-safe comparison.
 * Accepts either CRON_SECRET or TELEGRAM_BOT_TOKEN as valid bearer tokens.
 *
 * @param authHeader - The Authorization header value (should be "Bearer <token>")
 * @returns true if the token matches CRON_SECRET or TELEGRAM_BOT_TOKEN
 */
export function isValidCronRequest(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  const cronSecret = process.env.CRON_SECRET;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

  // Check against CRON_SECRET
  if (cronSecret && constantTimeCompare(token, cronSecret)) {
    return true;
  }

  // Check against TELEGRAM_BOT_TOKEN (for Telegram webhook callbacks)
  if (telegramToken && constantTimeCompare(token, telegramToken)) {
    return true;
  }

  return false;
}

/**
 * Validates a request is from Vercel Cron (checks both header and secret).
 * Use this for routes that should only be called by Vercel's cron scheduler.
 */
export function isVercelCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  return isValidCronRequest(authHeader);
}
