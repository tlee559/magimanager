/**
 * GoLogin API Client
 * Documentation: https://api.gologin.com/docs
 */

const GOLOGIN_API_URL = 'https://api.gologin.com';

export interface GoLoginProxyConfig {
  mode: 'none' | 'http' | 'socks4' | 'socks5';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface GoLoginProfileOptions {
  name: string;
  os?: 'win' | 'mac' | 'lin' | 'android';
  notes?: string;
  proxy?: GoLoginProxyConfig;
  extensions?: string[]; // Chrome Web Store extension IDs
}

// Default Chrome Web Store extensions (by ID)
export const DEFAULT_EXTENSIONS = [
  'bhghoamapcdpbohphigoooaddinpkbai', // Authenticator (2FA)
];

// Custom extensions hosted on our server (as zip URLs)
export const CUSTOM_EXTENSION_URLS = [
  'https://abra.magimanager.com/magimanager-connector.zip', // OAuth connector for Google Ads
];

// Common Windows fonts for realistic fingerprint
export const DEFAULT_WINDOWS_FONTS = [
  'Arial',
  'Arial Black',
  'Calibri',
  'Cambria',
  'Cambria Math',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Microsoft Sans Serif',
  'Palatino Linotype',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
];

export interface GoLoginProfile {
  id: string;
  name: string;
  os: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Provisioning status fields
  canBeRunning?: boolean;
  isRunning?: boolean;
  isRunDisabled?: boolean;
  runDisabledReason?: string;
  status?: string;
  lastActivity?: string;
}

export interface GoLoginError {
  statusCode: number;
  message: string;
}

export interface GoLoginFingerprint {
  navigator?: {
    userAgent?: string;
    resolution?: string;
    language?: string;
    platform?: string;
  };
  webGLMetadata?: {
    vendor?: string;
    renderer?: string;
  };
}

class GoLoginClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${GOLOGIN_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('GoLogin API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url,
      });
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        // Handle nested message objects
        const msg = errorJson.message;
        if (typeof msg === 'string') {
          errorMessage = msg;
        } else if (Array.isArray(msg)) {
          errorMessage = msg.map((m: unknown) => typeof m === 'string' ? m : JSON.stringify(m)).join(', ');
        } else if (msg && typeof msg === 'object') {
          errorMessage = JSON.stringify(msg);
        } else if (errorJson.error) {
          errorMessage = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
        }
      } catch {
        // Not JSON, use raw text
      }
      throw new Error(`GoLogin API error: ${response.status} - ${errorMessage}`);
    }

    // Some endpoints return empty response
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text);
  }

  /**
   * Create a new browser profile
   * Includes essential settings for ad account trust and fingerprint uniqueness
   * Includes: fonts (required), canvas/WebGL noise, WebRTC protection, timezone/geo from IP
   */
  async createProfile(options: GoLoginProfileOptions): Promise<GoLoginProfile> {
    const os = options.os || 'win';

    // Combine default extensions with any custom ones
    const extensions = [
      ...DEFAULT_EXTENSIONS,
      ...(options.extensions || []),
    ];

    const payload: Record<string, unknown> = {
      name: options.name,
      browserType: 'chrome',
      os: os,
      notes: options.notes || '',

      // Basic navigator - let GoLogin auto-generate most of it
      navigator: {
        userAgent: this.getDefaultUserAgent(os),
        resolution: '1920x1080',
        language: 'en-US,en',
        platform: os === 'mac' ? 'MacIntel' : os === 'lin' ? 'Linux x86_64' : 'Win32',
      },

      // Fonts - required by GoLogin API
      fonts: {
        families: DEFAULT_WINDOWS_FONTS,
        enableMasking: true,
        enableDomRect: true,
      },

      // Canvas/WebGL noise - important for uniqueness
      canvas: { mode: 'noise' },
      webGL: { mode: 'noise' },
      webGLMetadata: { mode: 'mask' },

      // WebRTC - prevent IP leaks
      webRTC: {
        mode: 'alerted',
        enabled: true,
        fillBasedOnIp: true,
      },

      // Timezone from IP - important for consistency
      timezone: {
        enabled: true,
        fillBasedOnIp: true,
      },

      // Geolocation from IP
      geolocation: {
        mode: 'prompt',
        fillBasedOnIp: true,
      },

      // Proxy settings
      proxy: options.proxy || { mode: 'none' },

      // Chrome Web Store extensions (by ID)
      chromeExtensions: extensions,

      // Custom extensions (by URL to .zip file)
      userChromeExtensions: CUSTOM_EXTENSION_URLS,
    };

    return this.request<GoLoginProfile>('/browser', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get default user agent for OS
   */
  private getDefaultUserAgent(os: string): string {
    const chromeVersion = '131.0.0.0';
    const userAgents: Record<string, string> = {
      win: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      mac: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      lin: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      android: `Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`,
    };
    return userAgents[os] || userAgents.win;
  }

  /**
   * Create a new browser profile with full custom parameters
   * Use this if you need specific fingerprint control
   */
  async createProfileWithParams(options: GoLoginProfileOptions): Promise<GoLoginProfile> {
    const os = options.os || 'win';

    // Generate a realistic Chrome user agent based on OS
    const chromeVersion = '131.0.0.0';
    const userAgents: Record<string, string> = {
      win: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      mac: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      lin: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      android: `Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`,
    };

    const payload = {
      name: options.name,
      browserType: 'chrome',
      os: os,
      notes: options.notes || '',
      navigator: {
        language: 'en-US',
        userAgent: userAgents[os] || userAgents.win,
        resolution: '1920x1080',
        platform: os === 'mac' ? 'MacIntel' : os === 'lin' ? 'Linux x86_64' : 'Win32',
      },
      proxy: options.proxy || { mode: 'none' },
      webRTC: {
        mode: 'altered',
        enabled: true,
      },
      canvas: {
        mode: 'noise',
      },
      webGL: {
        mode: 'noise',
      },
      webGLMetadata: {
        mode: 'mask',
      },
      timezone: {
        enabled: true,
        fillBasedOnIp: true,
      },
      geolocation: {
        mode: 'prompt',
      },
    };

    return this.request<GoLoginProfile>('/browser', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get a browser profile by ID
   */
  async getProfile(profileId: string): Promise<GoLoginProfile> {
    return this.request<GoLoginProfile>(`/browser/${profileId}`);
  }

  /**
   * Update a browser profile
   */
  async updateProfile(profileId: string, updates: Partial<GoLoginProfileOptions>): Promise<GoLoginProfile> {
    return this.request<GoLoginProfile>(`/browser/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a browser profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    await this.request(`/browser/${profileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all browser profiles
   */
  async listProfiles(): Promise<GoLoginProfile[]> {
    const response = await this.request<{ profiles: GoLoginProfile[] }>('/browser/v2');
    return response.profiles || [];
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listProfiles();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for profile to be ready (canBeRunning = true)
   * Polls the profile status until it's ready or times out
   * @param profileId - The profile ID to check
   * @param maxWaitMs - Maximum time to wait in milliseconds (default 30 seconds)
   * @param pollIntervalMs - How often to poll in milliseconds (default 2 seconds)
   * @returns The profile when ready, or throws if timeout
   */
  async waitForProfileReady(
    profileId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 2000
  ): Promise<GoLoginProfile> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const profile = await this.getProfile(profileId);

      // Profile is ready when canBeRunning is true and not disabled
      if (profile.canBeRunning === true && !profile.isRunDisabled) {
        return profile;
      }

      // If there's a specific reason it can't run, return early with that info
      if (profile.isRunDisabled && profile.runDisabledReason) {
        console.warn(`Profile ${profileId} cannot run: ${profile.runDisabledReason}`);
        // Still return the profile so caller can handle it
        return profile;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout - return whatever state we have
    const finalProfile = await this.getProfile(profileId);
    console.warn(`Profile ${profileId} readiness check timed out after ${maxWaitMs}ms`);
    return finalProfile;
  }

  /**
   * Check if a profile is ready to run
   */
  async isProfileReady(profileId: string): Promise<{ ready: boolean; reason?: string }> {
    const profile = await this.getProfile(profileId);

    if (profile.canBeRunning === true && !profile.isRunDisabled) {
      return { ready: true };
    }

    return {
      ready: false,
      reason: profile.runDisabledReason || (profile.canBeRunning === false ? 'Profile provisioning in progress' : 'Unknown'),
    };
  }

  /**
   * Update profile proxy settings
   */
  async updateProfileProxy(profileId: string, proxy: GoLoginProxyConfig): Promise<void> {
    await this.request(`/browser/${profileId}/proxy`, {
      method: 'PATCH',
      body: JSON.stringify(proxy),
    });
  }

  /**
   * Refresh profile fingerprint (regenerates canvas, WebGL, audio context, etc.)
   */
  async refreshFingerprint(profileId: string): Promise<void> {
    // GoLogin uses a PATCH to refresh the fingerprint
    await this.request(`/browser/${profileId}/fingerprint`, {
      method: 'PATCH',
    });
  }

  /**
   * Update user agent to latest Chrome version
   */
  async updateUserAgent(profileId: string, workspaceId?: string): Promise<void> {
    const payload: Record<string, unknown> = {
      profileIds: [profileId],
    };
    if (workspaceId) {
      payload.workspaceId = workspaceId;
    }
    await this.request('/browser/user-agent', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get a random fingerprint (useful for preview before creating profile)
   */
  async getRandomFingerprint(os: 'win' | 'mac' | 'lin' | 'android' = 'win'): Promise<GoLoginFingerprint> {
    return this.request<GoLoginFingerprint>(`/browser/fingerprint?os=${os}`);
  }

  /**
   * Add GoLogin's built-in proxy to a profile (uses GoLogin's residential proxy pool)
   * Requires a paid GoLogin plan with proxy traffic
   */
  async addGologinProxy(profileId: string, countryCode: string): Promise<void> {
    await this.request(`/browser/${profileId}/proxy`, {
      method: 'PATCH',
      body: JSON.stringify({
        mode: 'gologin',
        autoProxyRegion: countryCode.toLowerCase(),
      }),
    });
  }

  /**
   * Get cookies from a profile
   */
  async getCookies(profileId: string): Promise<unknown[]> {
    const response = await this.request<{ cookies: unknown[] }>(`/browser/${profileId}/cookies`);
    return response.cookies || [];
  }

  /**
   * Set cookies for a profile
   */
  async setCookies(profileId: string, cookies: unknown[]): Promise<void> {
    await this.request(`/browser/${profileId}/cookies`, {
      method: 'POST',
      body: JSON.stringify({ cookies }),
    });
  }
}

/**
 * Create a GoLogin client instance
 */
export function createGoLoginClient(apiKey: string): GoLoginClient {
  if (!apiKey) {
    throw new Error('GoLogin API key is required');
  }
  return new GoLoginClient(apiKey);
}

/**
 * Get GoLogin client using API key from database settings
 */
export async function getGoLoginClientFromSettings(): Promise<GoLoginClient> {
  // Import prisma here to avoid circular dependencies
  const { prisma } = await import('@/lib/db');

  const settings = await prisma.appSettings.findFirst();

  if (!settings?.gologinApiKey) {
    throw new Error('GoLogin API key not configured. Please set it in Settings.');
  }

  return createGoLoginClient(settings.gologinApiKey);
}

// ============================================================================
// BROWSER LAUNCH (Requires Orbita browser - local/desktop only)
// ============================================================================

export interface BrowserLaunchResult {
  success: boolean;
  message: string;
  wsEndpoint?: string;
  profileId?: string;
}

/**
 * Launch a GoLogin browser profile with a specific URL
 * IMPORTANT: This only works on machines with Orbita browser installed
 * (local development or dedicated server, NOT serverless)
 *
 * @param profileId - The GoLogin profile ID to launch
 * @param startUrl - The URL to open when browser starts
 * @returns Browser launch result with WebSocket endpoint
 */
export async function launchBrowserProfile(
  profileId: string,
  startUrl?: string
): Promise<BrowserLaunchResult> {
  try {
    // Dynamic import to avoid bundling issues in serverless
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GologinApi } = await import('gologin');

    // Get API key from settings
    const { prisma } = await import('@/lib/db');
    const settings = await prisma.appSettings.findFirst();

    if (!settings?.gologinApiKey) {
      return {
        success: false,
        message: 'GoLogin API key not configured. Please set it in Settings.',
      };
    }

    // Create GoLogin SDK instance
    const GL = GologinApi({
      token: settings.gologinApiKey,
    });

    // Launch the browser with the profile
    const { browser } = await GL.launch({
      profileId,
    });

    // If start URL provided, navigate to it
    if (startUrl && browser) {
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();
      await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    }

    return {
      success: true,
      message: 'Browser launched successfully. Complete the OAuth flow in the browser.',
      profileId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common errors
    if (errorMessage.includes('ENOENT') || errorMessage.includes('spawn')) {
      return {
        success: false,
        message: 'Orbita browser not found. GoLogin browser launch only works on machines with the GoLogin desktop app installed.',
      };
    }

    return {
      success: false,
      message: `Failed to launch browser: ${errorMessage}`,
    };
  }
}

/**
 * Launch a GoLogin browser profile and open OAuth authorization
 * Convenience method for OAuth flow
 *
 * @param profileId - The GoLogin profile ID
 * @param googleCid - The Google Ads CID to authorize
 * @returns Browser launch result
 */
export async function launchBrowserForOAuth(
  profileId: string,
  googleCid: string
): Promise<BrowserLaunchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://abra.magimanager.com';
  const normalizedCid = googleCid.replace(/-/g, '');
  const oauthUrl = `${baseUrl}/api/oauth/google-ads/authorize?cid=${normalizedCid}`;

  return launchBrowserProfile(profileId, oauthUrl);
}
