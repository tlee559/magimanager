// ============================================================================
// AUTOMATION TYPES - Rule-based automation engine
// ============================================================================

import type { CampaignStatus, AdStatus, KeywordStatus } from './campaigns';

// ============================================================================
// ENUMS
// ============================================================================

export type AutomationStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED' | 'ERROR';
export type TriggerType = 'SCHEDULE' | 'METRIC_THRESHOLD' | 'EVENT' | 'MANUAL';
export type ActionType =
  // Campaign actions
  | 'PAUSE_CAMPAIGN'
  | 'ENABLE_CAMPAIGN'
  | 'ADJUST_CAMPAIGN_BUDGET'
  // Ad actions
  | 'PAUSE_AD'
  | 'ENABLE_AD'
  // Keyword actions
  | 'PAUSE_KEYWORD'
  | 'ENABLE_KEYWORD'
  | 'ADJUST_KEYWORD_BID'
  | 'ADD_NEGATIVE_KEYWORD'
  // Bid actions
  | 'INCREASE_BID'
  | 'DECREASE_BID'
  | 'SET_BID'
  // Notifications
  | 'SEND_ALERT'
  | 'LOG_INSIGHT';

export type MetricType =
  | 'SPEND'
  | 'IMPRESSIONS'
  | 'CLICKS'
  | 'CTR'
  | 'CPC'
  | 'CONVERSIONS'
  | 'COST_PER_CONVERSION'
  | 'CONVERSION_RATE'
  | 'ROAS'
  | 'QUALITY_SCORE';

export type ComparisonOperator =
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'EQUAL_TO'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'BETWEEN'
  | 'CHANGED_BY_PERCENT'
  | 'CHANGED_BY_AMOUNT';

export type TimeWindow = '1_HOUR' | '24_HOURS' | '7_DAYS' | '30_DAYS' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH';

export type EntityScope = 'ACCOUNT' | 'CAMPAIGN' | 'AD_GROUP' | 'AD' | 'KEYWORD';

export type ExecutionResult = 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'WRITE_DISABLED';

// ============================================================================
// AUTOMATION RULE
// ============================================================================

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  status: AutomationStatus;
  priority: number;                // Lower = higher priority (1-100)

  // Scope
  scope: EntityScope;
  accountIds?: string[];           // Apply to specific accounts (empty = all)
  campaignIds?: string[];          // Apply to specific campaigns
  adGroupIds?: string[];           // Apply to specific ad groups

  // Trigger
  trigger: AutomationTrigger;

  // Conditions (all must be true)
  conditions: AutomationCondition[];

  // Actions (executed in order)
  actions: AutomationAction[];

  // Limits
  maxExecutionsPerDay?: number;
  cooldownMinutes?: number;        // Min time between executions

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastExecutedAt?: Date;
  executionCount: number;

  // Feature flag integration
  requiresWriteAccess: boolean;
}

// ============================================================================
// TRIGGER DEFINITIONS
// ============================================================================

export interface AutomationTrigger {
  type: TriggerType;
  schedule?: ScheduleTrigger;
  metricThreshold?: MetricThresholdTrigger;
  event?: EventTrigger;
}

export interface ScheduleTrigger {
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  hour?: number;                   // 0-23 for DAILY/WEEKLY/MONTHLY
  dayOfWeek?: number;              // 0-6 for WEEKLY (0 = Sunday)
  dayOfMonth?: number;             // 1-31 for MONTHLY
  timezone: string;                // e.g., 'America/New_York'
}

export interface MetricThresholdTrigger {
  metric: MetricType;
  operator: ComparisonOperator;
  value: number;
  secondValue?: number;            // For BETWEEN operator
  timeWindow: TimeWindow;
  checkInterval: 'REALTIME' | 'HOURLY' | 'DAILY';
}

export interface EventTrigger {
  eventType: 'CAMPAIGN_CREATED' | 'AD_APPROVED' | 'AD_DISAPPROVED' | 'BUDGET_DEPLETED' | 'SPEND_SPIKE' | 'CTR_DROP';
}

// ============================================================================
// CONDITION DEFINITIONS
// ============================================================================

export interface AutomationCondition {
  id: string;
  type: 'METRIC' | 'STATUS' | 'TIME' | 'LABEL' | 'CUSTOM';
  metric?: MetricCondition;
  status?: StatusCondition;
  time?: TimeCondition;
  label?: LabelCondition;
}

export interface MetricCondition {
  metric: MetricType;
  operator: ComparisonOperator;
  value: number;
  secondValue?: number;
  timeWindow: TimeWindow;
}

export interface StatusCondition {
  entityType: EntityScope;
  status: CampaignStatus | AdStatus | KeywordStatus;
  is: 'EQUALS' | 'NOT_EQUALS';
}

export interface TimeCondition {
  dayOfWeek?: number[];            // 0-6
  hourRange?: { start: number; end: number };
  dateRange?: { start: string; end: string };
}

export interface LabelCondition {
  labelName: string;
  has: boolean;
}

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

export interface AutomationAction {
  id: string;
  type: ActionType;
  requiresWriteAccess: boolean;

  // Budget/Bid adjustments
  adjustment?: {
    type: 'PERCENTAGE' | 'ABSOLUTE' | 'SET_TO';
    value: number;
    maxLimit?: number;
    minLimit?: number;
  };

  // Alert configuration
  alert?: {
    channels: ('EMAIL' | 'SLACK' | 'TELEGRAM' | 'IN_APP')[];
    message: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };

  // Negative keyword
  negativeKeyword?: {
    matchType: 'EXACT' | 'PHRASE' | 'BROAD';
    level: 'CAMPAIGN' | 'AD_GROUP';
  };
}

// ============================================================================
// EXECUTION LOG
// ============================================================================

export interface AutomationExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  accountId: string;

  // Execution details
  triggeredAt: Date;
  completedAt?: Date;
  result: ExecutionResult;
  errorMessage?: string;

  // Entity affected
  entityType: EntityScope;
  entityId: string;
  entityName: string;

  // Changes made
  actionsTaken: ActionResult[];

  // Snapshot
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

export interface ActionResult {
  actionType: ActionType;
  success: boolean;
  errorMessage?: string;
  oldValue?: string | number;
  newValue?: string | number;
}

// ============================================================================
// RULE PRESETS (Templates)
// ============================================================================

export interface RulePreset {
  id: string;
  name: string;
  description: string;
  category: 'BUDGET' | 'PERFORMANCE' | 'PROTECTION' | 'OPTIMIZATION' | 'SCHEDULING';
  icon: string;

  // Pre-configured rule
  rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'executionCount' | 'lastExecutedAt'>;
}

export const RULE_PRESETS: RulePreset[] = [
  {
    id: 'pause-high-spend-low-conversions',
    name: 'Pause High Spend, Low Conversions',
    description: 'Automatically pause campaigns spending over budget with no conversions',
    category: 'PROTECTION',
    icon: '🛑',
    rule: {
      name: 'Pause High Spend Low Conversions',
      status: 'PAUSED',
      priority: 10,
      scope: 'CAMPAIGN',
      trigger: {
        type: 'METRIC_THRESHOLD',
        metricThreshold: {
          metric: 'SPEND',
          operator: 'GREATER_THAN',
          value: 100,
          timeWindow: 'TODAY',
          checkInterval: 'HOURLY',
        },
      },
      conditions: [
        {
          id: 'no-conversions',
          type: 'METRIC',
          metric: {
            metric: 'CONVERSIONS',
            operator: 'EQUAL_TO',
            value: 0,
            timeWindow: 'TODAY',
          },
        },
      ],
      actions: [
        {
          id: 'pause-campaign',
          type: 'PAUSE_CAMPAIGN',
          requiresWriteAccess: true,
        },
        {
          id: 'send-alert',
          type: 'SEND_ALERT',
          requiresWriteAccess: false,
          alert: {
            channels: ['IN_APP', 'TELEGRAM'],
            message: 'Campaign paused due to high spend (${{spend}}) with no conversions',
            priority: 'HIGH',
          },
        },
      ],
      requiresWriteAccess: true,
    },
  },
  {
    id: 'increase-budget-high-roas',
    name: 'Increase Budget on High ROAS',
    description: 'Boost budget by 20% when ROAS exceeds 300%',
    category: 'OPTIMIZATION',
    icon: '📈',
    rule: {
      name: 'Increase Budget High ROAS',
      status: 'PAUSED',
      priority: 50,
      scope: 'CAMPAIGN',
      trigger: {
        type: 'SCHEDULE',
        schedule: {
          frequency: 'DAILY',
          hour: 9,
          timezone: 'America/New_York',
        },
      },
      conditions: [
        {
          id: 'high-roas',
          type: 'METRIC',
          metric: {
            metric: 'ROAS',
            operator: 'GREATER_THAN',
            value: 3.0,
            timeWindow: '7_DAYS',
          },
        },
        {
          id: 'min-conversions',
          type: 'METRIC',
          metric: {
            metric: 'CONVERSIONS',
            operator: 'GREATER_THAN',
            value: 5,
            timeWindow: '7_DAYS',
          },
        },
      ],
      actions: [
        {
          id: 'increase-budget',
          type: 'ADJUST_CAMPAIGN_BUDGET',
          requiresWriteAccess: true,
          adjustment: {
            type: 'PERCENTAGE',
            value: 20,
            maxLimit: 500, // Cap at $500/day
          },
        },
      ],
      requiresWriteAccess: true,
    },
  },
  {
    id: 'pause-low-quality-keywords',
    name: 'Pause Low Quality Keywords',
    description: 'Pause keywords with quality score below 4',
    category: 'OPTIMIZATION',
    icon: '🎯',
    rule: {
      name: 'Pause Low Quality Keywords',
      status: 'PAUSED',
      priority: 40,
      scope: 'KEYWORD',
      trigger: {
        type: 'SCHEDULE',
        schedule: {
          frequency: 'WEEKLY',
          hour: 8,
          dayOfWeek: 1,
          timezone: 'America/New_York',
        },
      },
      conditions: [
        {
          id: 'low-quality',
          type: 'METRIC',
          metric: {
            metric: 'QUALITY_SCORE',
            operator: 'LESS_THAN',
            value: 4,
            timeWindow: '7_DAYS',
          },
        },
        {
          id: 'has-impressions',
          type: 'METRIC',
          metric: {
            metric: 'IMPRESSIONS',
            operator: 'GREATER_THAN',
            value: 100,
            timeWindow: '30_DAYS',
          },
        },
      ],
      actions: [
        {
          id: 'pause-keyword',
          type: 'PAUSE_KEYWORD',
          requiresWriteAccess: true,
        },
        {
          id: 'log-insight',
          type: 'LOG_INSIGHT',
          requiresWriteAccess: false,
        },
      ],
      requiresWriteAccess: true,
    },
  },
  {
    id: 'weekend-budget-reduction',
    name: 'Weekend Budget Reduction',
    description: 'Reduce budget by 30% on weekends',
    category: 'SCHEDULING',
    icon: '📅',
    rule: {
      name: 'Weekend Budget Reduction',
      status: 'PAUSED',
      priority: 30,
      scope: 'CAMPAIGN',
      trigger: {
        type: 'SCHEDULE',
        schedule: {
          frequency: 'WEEKLY',
          hour: 0,
          dayOfWeek: 6, // Saturday
          timezone: 'America/New_York',
        },
      },
      conditions: [
        {
          id: 'weekend-check',
          type: 'TIME',
          time: {
            dayOfWeek: [0, 6], // Sunday and Saturday
          },
        },
      ],
      actions: [
        {
          id: 'reduce-budget',
          type: 'ADJUST_CAMPAIGN_BUDGET',
          requiresWriteAccess: true,
          adjustment: {
            type: 'PERCENTAGE',
            value: -30,
            minLimit: 10, // Keep at least $10/day
          },
        },
      ],
      requiresWriteAccess: true,
    },
  },
  {
    id: 'spend-spike-alert',
    name: 'Spend Spike Alert',
    description: 'Alert when hourly spend exceeds daily average by 50%',
    category: 'PROTECTION',
    icon: '🚨',
    rule: {
      name: 'Spend Spike Alert',
      status: 'PAUSED',
      priority: 5,
      scope: 'ACCOUNT',
      trigger: {
        type: 'METRIC_THRESHOLD',
        metricThreshold: {
          metric: 'SPEND',
          operator: 'CHANGED_BY_PERCENT',
          value: 50,
          timeWindow: '1_HOUR',
          checkInterval: 'HOURLY',
        },
      },
      conditions: [],
      actions: [
        {
          id: 'alert-spike',
          type: 'SEND_ALERT',
          requiresWriteAccess: false,
          alert: {
            channels: ['TELEGRAM', 'IN_APP'],
            message: 'Spend spike detected: {{currentSpend}} ({{percentChange}}% increase)',
            priority: 'CRITICAL',
          },
        },
      ],
      requiresWriteAccess: false,
    },
  },
];

// ============================================================================
// AI INSIGHT
// ============================================================================

export type InsightType =
  | 'PERFORMANCE_ANOMALY'
  | 'OPTIMIZATION_OPPORTUNITY'
  | 'BUDGET_RECOMMENDATION'
  | 'KEYWORD_SUGGESTION'
  | 'AD_COPY_SUGGESTION'
  | 'BIDDING_RECOMMENDATION'
  | 'TREND_ANALYSIS'
  | 'COMPETITOR_INSIGHT';

export type InsightPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AIInsight {
  id: string;
  accountId: string;
  campaignId?: string;
  adGroupId?: string;

  type: InsightType;
  priority: InsightPriority;
  title: string;
  summary: string;
  details: string;

  // AI recommendation
  recommendation?: {
    action: ActionType;
    confidence: number;           // 0-1
    estimatedImpact: string;
    parameters?: Record<string, unknown>;
  };

  // Status
  status: 'NEW' | 'REVIEWED' | 'APPLIED' | 'DISMISSED';
  reviewedAt?: Date;
  reviewedBy?: string;
  appliedAt?: Date;

  // Outcome tracking
  outcomeTracked: boolean;
  actualImpact?: string;

  createdAt: Date;
  expiresAt?: Date;
}

// ============================================================================
// AUTOMATION SUMMARY
// ============================================================================

export interface AutomationSummary {
  totalRules: number;
  activeRules: number;
  pausedRules: number;
  disabledRules: number;
  errorRules: number;

  // Execution stats (last 24h)
  executionsToday: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedExecutions: number;
  writeDisabledExecutions: number;

  // Top performing rules
  topRules: {
    ruleId: string;
    ruleName: string;
    executionCount: number;
    successRate: number;
  }[];
}
