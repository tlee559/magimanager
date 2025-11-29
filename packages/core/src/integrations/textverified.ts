/**
 * TextVerified API Client
 * Documentation: https://www.textverified.com/Api
 *
 * TextVerified provides non-VoIP (real SIM) phone numbers for SMS verification.
 * These have ~95% success rate with Google Ads verification compared to ~30% for VoIP.
 */

import { prisma } from '@magimanager/database';

const TEXTVERIFIED_API_URL = 'https://www.textverified.com/api';

// Google service ID for TextVerified
// This tells TextVerified we need a number that works with Google
export const GOOGLE_SERVICE_ID = 'google';

export interface TextVerifiedBalance {
  balance: number; // Balance in USD
  currency: string;
}

export interface TextVerifiedVerification {
  id: string;
  phone: string; // The phone number (e.g., "+12025551234")
  status: 'pending' | 'waiting' | 'completed' | 'cancelled' | 'expired';
  code?: string; // The SMS verification code (if received)
  sms?: string; // Full SMS message (if received)
  expiresAt?: string; // When the number rental expires
  createdAt?: string;
  cost?: number; // Cost in USD
  service?: string; // The service this verification is for
}

export interface TextVerifiedError {
  statusCode: number;
  message: string;
}

class TextVerifiedClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${TEXTVERIFIED_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('TextVerified API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url,
      });

      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage =
            typeof errorJson.message === 'string'
              ? errorJson.message
              : JSON.stringify(errorJson.message);
        } else if (errorJson.error) {
          errorMessage =
            typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
        }
      } catch {
        // Not JSON, use raw text
      }

      // Handle specific error codes
      if (response.status === 402) {
        throw new Error('Insufficient balance. Please add funds to your TextVerified account.');
      }
      if (response.status === 503) {
        throw new Error(
          'No phone numbers available for Google verification right now. Please try again later.'
        );
      }
      if (response.status === 401) {
        throw new Error(
          'Invalid TextVerified API key. Please check your API key in settings.'
        );
      }

      throw new Error(`TextVerified API error: ${response.status} - ${errorMessage}`);
    }

    // Some endpoints return empty response
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text);
  }

  /**
   * Get current account balance
   */
  async getBalance(): Promise<TextVerifiedBalance> {
    const response = await this.request<{ balance: number; currency?: string }>(
      '/Users/Balance'
    );
    return {
      balance: response.balance || 0,
      currency: response.currency || 'USD',
    };
  }

  /**
   * Start a new verification - rent a phone number for SMS verification
   * @param service - The service to verify (e.g., "google")
   * @returns Verification details including the phone number
   */
  async startVerification(service: string = GOOGLE_SERVICE_ID): Promise<TextVerifiedVerification> {
    const response = await this.request<TextVerifiedVerification>('/Verifications', {
      method: 'POST',
      body: JSON.stringify({
        id: service, // TextVerified uses "id" for service name
      }),
    });

    return {
      id: response.id,
      phone: response.phone,
      status: response.status || 'pending',
      expiresAt: response.expiresAt,
      createdAt: response.createdAt,
      cost: response.cost,
      service: service,
    };
  }

  /**
   * Check verification status and get SMS code if received
   * @param verificationId - The verification ID from startVerification
   * @returns Updated verification with code if received
   */
  async checkVerification(verificationId: string): Promise<TextVerifiedVerification> {
    const response = await this.request<TextVerifiedVerification>(
      `/Verifications/${verificationId}`
    );

    return {
      id: response.id || verificationId,
      phone: response.phone,
      status: response.status || 'pending',
      code: response.code,
      sms: response.sms,
      expiresAt: response.expiresAt,
      createdAt: response.createdAt,
      cost: response.cost,
    };
  }

  /**
   * Cancel an active verification (if number not needed anymore)
   * @param verificationId - The verification ID to cancel
   */
  async cancelVerification(verificationId: string): Promise<void> {
    await this.request(`/Verifications/${verificationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get list of available services with their prices
   */
  async getServices(): Promise<Array<{ id: string; name: string; price: number }>> {
    return this.request('/SimpleAuthentication/Services');
  }

  /**
   * Test API connection by checking balance
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getBalance();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create a TextVerified client instance
 */
export function createTextVerifiedClient(apiKey: string): TextVerifiedClient {
  if (!apiKey) {
    throw new Error('TextVerified API key is required');
  }
  return new TextVerifiedClient(apiKey);
}

/**
 * Get TextVerified client using API key from database settings
 */
export async function getTextVerifiedClientFromSettings(): Promise<TextVerifiedClient> {
  const settings = await prisma.appSettings.findFirst();

  if (!settings?.textverifiedApiKey) {
    throw new Error('TextVerified API key not configured. Please set it in Settings.');
  }

  return createTextVerifiedClient(settings.textverifiedApiKey);
}

/**
 * Format phone number for display (add dashes)
 * Input: "+12025551234"
 * Output: "+1 (202) 555-1234"
 */
export function formatPhoneNumber(phone: string): string {
  // Remove non-digits except leading +
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    // US number without country code
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Return as-is if not standard US format
  return hasPlus ? phone : `+${phone}`;
}

/**
 * Extract just the verification code from an SMS message
 * Common patterns: "Your code is 123456", "G-123456", "123456 is your code"
 */
export function extractCodeFromSms(sms: string): string | null {
  if (!sms) return null;

  // Look for 4-8 digit codes
  // Common patterns:
  // - "G-123456"
  // - "Your verification code is: 123456"
  // - "123456 is your Google verification code"
  // - "Use 123456 to verify"

  // Pattern 1: G-XXXXXX (Google's format)
  const googlePattern = /G-(\d{6})/i;
  const googleMatch = sms.match(googlePattern);
  if (googleMatch) return googleMatch[1];

  // Pattern 2: Standalone 4-8 digit number
  const standalonePattern = /\b(\d{4,8})\b/;
  const standaloneMatch = sms.match(standalonePattern);
  if (standaloneMatch) return standaloneMatch[1];

  return null;
}
