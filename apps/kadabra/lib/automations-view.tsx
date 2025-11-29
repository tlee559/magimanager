"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Play,
  Pause,
  Trash2,
  Edit2,
  Copy,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  Lock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Calendar,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import {
  isFeatureEnabled,
  RULE_PRESETS,
  type AutomationRule,
  type AutomationStatus,
  type TriggerType,
  type EntityScope,
  type ExecutionResult,
  type RulePreset,
  type AutomationExecution,
} from "@magimanager/shared";

// ============================================================================
// TYPES
// ============================================================================

// Database representation - trigger/conditions/actions are stored as JSON strings
interface DbAutomationRule extends Omit<AutomationRule, 'trigger' | 'conditions' | 'actions'> {
  trigger: string;
  conditions: string;
  actions: string;
}

interface AutomationsViewProps {
  accountId?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStatusBadge(status: AutomationStatus): { color: string; label: string; icon: React.ReactNode } {
  switch (status) {
    case "ACTIVE":
      return {
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        label: "Active",
        icon: <Play className="w-3 h-3" />,
      };
    case "PAUSED":
      return {
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        label: "Paused",
        icon: <Pause className="w-3 h-3" />,
      };
    case "DISABLED":
      return {
        color: "bg-slate-500/20 text-slate-400 border-slate-500/30",
        label: "Disabled",
        icon: <XCircle className="w-3 h-3" />,
      };
    case "ERROR":
      return {
        color: "bg-red-500/20 text-red-400 border-red-500/30",
        label: "Error",
        icon: <AlertTriangle className="w-3 h-3" />,
      };
  }
}

function getTriggerLabel(type: TriggerType): string {
  switch (type) {
    case "SCHEDULE": return "Scheduled";
    case "METRIC_THRESHOLD": return "Metric Trigger";
    case "EVENT": return "Event-based";
    case "MANUAL": return "Manual";
  }
}

function getScopeLabel(scope: EntityScope): string {
  switch (scope) {
    case "ACCOUNT": return "Account-level";
    case "CAMPAIGN": return "Campaigns";
    case "AD_GROUP": return "Ad Groups";
    case "AD": return "Ads";
    case "KEYWORD": return "Keywords";
  }
}

function getExecutionResultBadge(result: ExecutionResult): { color: string; icon: React.ReactNode } {
  switch (result) {
    case "SUCCESS":
      return { color: "text-emerald-400", icon: <CheckCircle className="w-4 h-4" /> };
    case "FAILED":
      return { color: "text-red-400", icon: <XCircle className="w-4 h-4" /> };
    case "SKIPPED":
      return { color: "text-slate-400", icon: <ChevronRight className="w-4 h-4" /> };
    case "PENDING":
      return { color: "text-yellow-400", icon: <Clock className="w-4 h-4" /> };
    case "WRITE_DISABLED":
      return { color: "text-amber-400", icon: <Lock className="w-4 h-4" /> };
  }
}

// Coming Soon Badge component
function ComingSoonBadge({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-300 rounded-full ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <Zap className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      Coming Soon
    </span>
  );
}

// ============================================================================
// RULE CARD COMPONENT
// ============================================================================

interface RuleCardProps {
  rule: DbAutomationRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function RuleCard({ rule, onToggle, onEdit, onDelete, onDuplicate }: RuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusBadge = getStatusBadge(rule.status);
  const canExecute = isFeatureEnabled("automation.execute");
  const trigger = JSON.parse(rule.trigger);

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Main Row */}
      <div className="flex items-center gap-4 p-4">
        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-slate-700 rounded transition"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {/* Status Indicator */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center border ${statusBadge.color}`}
        >
          {statusBadge.icon}
        </div>

        {/* Rule Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100 truncate">
              {rule.name}
            </span>
            {rule.requiresWriteAccess && !canExecute && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400">
                <Lock className="w-2.5 h-2.5" />
                Write required
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getTriggerLabel(trigger.type)}
            </span>
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {getScopeLabel(rule.scope)}
            </span>
            <span>Priority: {rule.priority}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-sm font-medium text-slate-100">
              {rule.executionCount}
            </div>
            <div className="text-xs text-slate-500">Executions</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-100">
              {rule.lastExecutedAt
                ? new Date(rule.lastExecutedAt).toLocaleDateString()
                : "Never"}
            </div>
            <div className="text-xs text-slate-500">Last Run</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg transition ${
              rule.status === "ACTIVE"
                ? "hover:bg-yellow-500/10 text-yellow-400"
                : "hover:bg-emerald-500/10 text-emerald-400"
            }`}
            title={rule.status === "ACTIVE" ? "Pause Rule" : "Activate Rule"}
          >
            {rule.status === "ACTIVE" ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400"
            title="Edit Rule"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDuplicate}
            className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400"
            title="Duplicate Rule"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-500/10 rounded-lg transition text-red-400"
            title="Delete Rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-slate-500 text-xs mb-1">Description</div>
              <div className="text-slate-300">
                {rule.description || "No description"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Limits</div>
              <div className="text-slate-300">
                {rule.maxExecutionsPerDay
                  ? `Max ${rule.maxExecutionsPerDay}/day`
                  : "No daily limit"}
                {rule.cooldownMinutes && ` | ${rule.cooldownMinutes}min cooldown`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PRESET CARD COMPONENT
// ============================================================================

interface PresetCardProps {
  preset: RulePreset;
  onUse: () => void;
}

function PresetCard({ preset, onUse }: PresetCardProps) {
  const canExecute = isFeatureEnabled("automation.execute");
  const isWriteRequired = preset.rule.requiresWriteAccess;

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4 hover:border-violet-500/30 transition group">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{preset.icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-100">{preset.name}</h4>
            {isWriteRequired && !canExecute && (
              <Lock className="w-3 h-3 text-amber-400" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{preset.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 bg-slate-700 rounded text-slate-400 uppercase">
              {preset.category}
            </span>
          </div>
        </div>
        <button
          onClick={onUse}
          className="px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg text-sm transition opacity-0 group-hover:opacity-100"
        >
          Use
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}

function StatsCard({ icon, label, value, subValue, color }: StatsCardProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-100">{value}</div>
      {subValue && <div className="text-xs text-slate-500">{subValue}</div>}
    </div>
  );
}

// ============================================================================
// MAIN AUTOMATIONS VIEW
// ============================================================================

export function AutomationsView({ accountId }: AutomationsViewProps) {
  const [rules, setRules] = useState<DbAutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AutomationStatus | "ALL">("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Feature flags
  const canView = isFeatureEnabled("automation.view");
  const canCreate = isFeatureEnabled("automation.create");
  const canEdit = isFeatureEnabled("automation.edit");
  const canExecute = isFeatureEnabled("automation.execute");

  // Fetch automations
  async function fetchAutomations() {
    if (!canView) {
      setError("Automation viewing is disabled");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [rulesRes, executionsRes] = await Promise.all([
        fetch(`/api/automations${accountId ? `?accountId=${accountId}` : ""}`),
        fetch(`/api/automations/executions?limit=10`),
      ]);

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }

      if (executionsRes.ok) {
        const data = await executionsRes.json();
        setExecutions(data.executions || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAutomations();
  }, [accountId]);

  // Filter rules
  const filteredRules = useMemo(() => {
    let result = [...rules];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter((r) => r.status === statusFilter);
    }

    return result;
  }, [rules, searchQuery, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const active = rules.filter((r) => r.status === "ACTIVE").length;
    const paused = rules.filter((r) => r.status === "PAUSED").length;
    const errors = rules.filter((r) => r.status === "ERROR").length;
    const todayExecutions = executions.filter(
      (e) => new Date(e.triggeredAt).toDateString() === new Date().toDateString()
    ).length;
    const successRate =
      executions.length > 0
        ? (executions.filter((e) => e.result === "SUCCESS").length / executions.length) * 100
        : 0;

    return { total: rules.length, active, paused, errors, todayExecutions, successRate };
  }, [rules, executions]);

  // Handle actions
  async function handleToggleRule(ruleId: string, currentStatus: AutomationStatus) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await fetch(`/api/automations/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchAutomations();
    } catch (error) {
      console.error("Failed to toggle rule:", error);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm("Are you sure you want to delete this automation rule?")) return;
    try {
      await fetch(`/api/automations/${ruleId}`, { method: "DELETE" });
      fetchAutomations();
    } catch (error) {
      console.error("Failed to delete rule:", error);
    }
  }

  async function handleSync() {
    setSyncing(true);
    await fetchAutomations();
    setSyncing(false);
  }

  function handleUsePreset(preset: RulePreset) {
    // In a full implementation, this would open the create modal with preset values
    console.log("Use preset:", preset);
    setShowCreateModal(true);
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">Failed to load automations</div>
        <div className="text-sm text-slate-500 mb-4">{error}</div>
        <button
          onClick={fetchAutomations}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Automations</h2>
          <p className="text-sm text-slate-500">
            Rule-based automation to optimize your campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
          {canCreate && (
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </button>
          )}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-700/30 rounded-lg text-sm text-slate-500 cursor-not-allowed">
            <Zap className="w-4 h-4" />
            Auto-Execute
            <ComingSoonBadge />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={<Zap className="w-4 h-4 text-violet-400" />}
          label="Total Rules"
          value={stats.total}
          subValue={`${stats.active} active`}
          color="bg-violet-500/10"
        />
        <StatsCard
          icon={<Play className="w-4 h-4 text-emerald-400" />}
          label="Executions Today"
          value={stats.todayExecutions}
          color="bg-emerald-500/10"
        />
        <StatsCard
          icon={<CheckCircle className="w-4 h-4 text-blue-400" />}
          label="Success Rate"
          value={`${stats.successRate.toFixed(0)}%`}
          color="bg-blue-500/10"
        />
        <StatsCard
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          label="Errors"
          value={stats.errors}
          color="bg-red-500/10"
        />
      </div>

      {/* Presets Section */}
      {showPresets && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Rule Templates</h3>
            <button
              onClick={() => setShowPresets(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Hide templates
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RULE_PRESETS.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onUse={() => handleUsePreset(preset)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rules..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AutomationStatus | "ALL")}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="DISABLED">Disabled</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
            <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-400 mb-1">No automation rules found</div>
            <div className="text-sm text-slate-600 mb-4">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your filters"
                : "Create your first rule to automate campaign management"}
            </div>
            {canCreate && (
              <button
                onClick={() => setShowPresets(true)}
                className="px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg transition"
              >
                Browse Templates
              </button>
            )}
          </div>
        ) : (
          filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => handleToggleRule(rule.id, rule.status)}
              onEdit={() => console.log("Edit:", rule.id)}
              onDelete={() => handleDeleteRule(rule.id)}
              onDuplicate={() => console.log("Duplicate:", rule.id)}
            />
          ))
        )}
      </div>

      {/* Recent Executions */}
      {executions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300">Recent Executions</h3>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="divide-y divide-slate-800">
              {executions.slice(0, 5).map((execution) => {
                const resultBadge = getExecutionResultBadge(execution.result);
                return (
                  <div key={execution.id} className="flex items-center gap-4 px-4 py-3">
                    <div className={resultBadge.color}>{resultBadge.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-100 truncate">
                        {execution.ruleName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {execution.entityName} ({execution.entityType})
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(execution.triggeredAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
