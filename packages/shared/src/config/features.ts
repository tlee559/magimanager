// ============================================================================
// FEATURE FLAGS - Toggle capabilities across Kadabra
// ============================================================================

/**
 * Feature flag definitions for Kadabra
 *
 * These flags control which features are enabled/disabled.
 * Write operations are disabled by default until Google Ads API approval.
 */

export type FeatureFlag =
  // Campaign Management
  | 'campaigns.view'           // View campaigns list and details
  | 'campaigns.create'         // Create new campaigns (WRITE)
  | 'campaigns.edit'           // Edit campaign settings (WRITE)
  | 'campaigns.pause'          // Pause/enable campaigns (WRITE)
  | 'campaigns.delete'         // Delete campaigns (WRITE)
  // Ad Management
  | 'ads.view'                 // View ads list and details
  | 'ads.create'               // Create new ads (WRITE)
  | 'ads.edit'                 // Edit ad content (WRITE)
  | 'ads.pause'                // Pause/enable ads (WRITE)
  | 'ads.delete'               // Delete ads (WRITE)
  // Keyword Management
  | 'keywords.view'            // View keywords list
  | 'keywords.add'             // Add new keywords (WRITE)
  | 'keywords.edit'            // Edit keyword bids (WRITE)
  | 'keywords.pause'           // Pause/enable keywords (WRITE)
  | 'keywords.remove'          // Remove keywords (WRITE)
  // Budget Management
  | 'budgets.view'             // View budgets
  | 'budgets.adjust'           // Adjust budgets (WRITE)
  // Bid Management
  | 'bids.view'                // View bid strategies
  | 'bids.adjust'              // Adjust bids (WRITE)
  // Automation
  | 'automation.view'          // View automation rules
  | 'automation.create'        // Create automation rules
  | 'automation.edit'          // Edit automation rules
  | 'automation.execute'       // Execute automation actions (WRITE - affects Google Ads)
  // AI Features
  | 'ai.chat'                  // AI chat panel
  | 'ai.insights'              // AI-generated insights
  | 'ai.recommendations'       // AI recommendations
  | 'ai.autoApply'             // Auto-apply AI suggestions (WRITE)
  // Analytics
  | 'analytics.view'           // View analytics dashboards
  | 'analytics.export'         // Export reports
  // Account Sync
  | 'sync.manual'              // Manual sync trigger
  | 'sync.auto';               // Automatic background sync

export interface FeatureConfig {
  enabled: boolean;
  requiresApiWrite: boolean;  // True if this feature needs Google Ads write access
  description: string;
}

/**
 * Default feature configuration
 *
 * READ operations: enabled by default
 * WRITE operations: disabled by default (requires API approval)
 */
export const FEATURE_FLAGS: Record<FeatureFlag, FeatureConfig> = {
  // Campaign Management
  'campaigns.view': {
    enabled: true,
    requiresApiWrite: false,
    description: 'View campaigns list and details'
  },
  'campaigns.create': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Create new campaigns'
  },
  'campaigns.edit': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Edit campaign settings'
  },
  'campaigns.pause': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Pause or enable campaigns'
  },
  'campaigns.delete': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Delete campaigns'
  },

  // Ad Management
  'ads.view': {
    enabled: true,
    requiresApiWrite: false,
    description: 'View ads list and details'
  },
  'ads.create': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Create new ads'
  },
  'ads.edit': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Edit ad content'
  },
  'ads.pause': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Pause or enable ads'
  },
  'ads.delete': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Delete ads'
  },

  // Keyword Management
  'keywords.view': {
    enabled: true,
    requiresApiWrite: false,
    description: 'View keywords list'
  },
  'keywords.add': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Add new keywords'
  },
  'keywords.edit': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Edit keyword bids and settings'
  },
  'keywords.remove': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Remove keywords'
  },
  'keywords.pause': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Pause or enable keywords'
  },

  // Budget Management
  'budgets.view': {
    enabled: true,
    requiresApiWrite: false,
    description: 'View campaign budgets'
  },
  'budgets.adjust': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Adjust campaign budgets'
  },

  // Bid Management
  'bids.view': {
    enabled: true,
    requiresApiWrite: false,
    description: 'View bid strategies'
  },
  'bids.adjust': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Adjust bids'
  },

  // Automation
  'automation.view': {
    enabled: true,
    requiresApiWrite: false,
    description: 'View automation rules'
  },
  'automation.create': {
    enabled: true,
    requiresApiWrite: false,
    description: 'Create automation rules'
  },
  'automation.edit': {
    enabled: true,
    requiresApiWrite: false,
    description: 'Edit automation rules'
  },
  'automation.execute': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Execute automation actions that modify Google Ads'
  },

  // AI Features
  'ai.chat': {
    enabled: true,
    requiresApiWrite: false,
    description: 'AI chat panel for questions and analysis'
  },
  'ai.insights': {
    enabled: true,
    requiresApiWrite: false,
    description: 'AI-generated insights from data'
  },
  'ai.recommendations': {
    enabled: true,
    requiresApiWrite: false,
    description: 'AI recommendations for optimization'
  },
  'ai.autoApply': {
    enabled: false,
    requiresApiWrite: true,
    description: 'Auto-apply AI suggestions'
  },

  // Analytics
  'analytics.view': {
    enabled: true,
    requiresApiWrite: false,
    description: 'View analytics dashboards'
  },
  'analytics.export': {
    enabled: true,
    requiresApiWrite: false,
    description: 'Export reports to CSV/PDF'
  },

  // Account Sync
  'sync.manual': {
    enabled: true,
    requiresApiWrite: false,
    description: 'Manually trigger account sync'
  },
  'sync.auto': {
    enabled: true,
    requiresApiWrite: false,
    description: 'Automatic background sync'
  },
};

// ============================================================================
// FEATURE FLAG HELPERS
// ============================================================================

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]?.enabled ?? false;
}

/**
 * Check if a feature requires write API access
 */
export function requiresWriteAccess(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]?.requiresApiWrite ?? false;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(
    (flag) => FEATURE_FLAGS[flag].enabled
  );
}

/**
 * Get all disabled features that require write access
 * Useful for showing "Coming Soon" or "Requires API Approval" badges
 */
export function getWriteLockedFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(
    (flag) => !FEATURE_FLAGS[flag].enabled && FEATURE_FLAGS[flag].requiresApiWrite
  );
}

/**
 * Enable all write features (call when Google Ads API is approved)
 * Note: This is for runtime toggling. In production, you'd use env vars.
 */
export function enableWriteFeatures(): void {
  (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).forEach((flag) => {
    if (FEATURE_FLAGS[flag].requiresApiWrite) {
      FEATURE_FLAGS[flag].enabled = true;
    }
  });
}

/**
 * Environment-based feature flag override
 * Set KADABRA_WRITE_ENABLED=true to enable all write features
 */
export function initializeFeatureFlags(): void {
  if (typeof process !== 'undefined' && process.env.KADABRA_WRITE_ENABLED === 'true') {
    enableWriteFeatures();
  }
}

// Initialize on module load
initializeFeatureFlags();
