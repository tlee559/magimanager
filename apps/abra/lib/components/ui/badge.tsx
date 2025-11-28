"use client";

// ============================================================================
// BADGE COMPONENT
// ============================================================================

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "slate"
  | "emerald"
  | "amber"
  | "red"
  | "blue"
  | "green"
  | "orange";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-500/20 text-slate-400",
  success: "bg-emerald-500/20 text-emerald-400",
  warning: "bg-amber-500/20 text-amber-400",
  error: "bg-red-500/20 text-red-400",
  info: "bg-blue-500/20 text-blue-400",
  slate: "bg-slate-500/10 text-slate-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
  amber: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  blue: "bg-blue-500/10 text-blue-400",
  green: "bg-green-500/10 text-green-400",
  orange: "bg-orange-500/10 text-orange-400",
};

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-1 text-xs",
};

export function Badge({ children, variant = "default", size = "md", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}

// ============================================================================
// STATUS DOT COMPONENT
// ============================================================================

interface StatusDotProps {
  status: boolean;
  title?: string;
}

export function StatusDot({ status, title }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full ${status ? "bg-emerald-500" : "bg-red-500"}`}
      title={title}
    />
  );
}

// ============================================================================
// LIFECYCLE BADGE
// ============================================================================

type LifecycleStatus = "provisioned" | "warming-up" | "ready" | "handed-off" | string;

interface LifecycleBadgeProps {
  status: LifecycleStatus;
  handoffStatus?: string;
}

export function LifecycleBadge({ status, handoffStatus }: LifecycleBadgeProps) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    provisioned: { bg: "bg-slate-500/10", text: "text-slate-400", label: "Provisioned" },
    "warming-up": { bg: "bg-amber-500/10", text: "text-amber-400", label: "Warming Up" },
    ready: { bg: "bg-green-500/10", text: "text-green-400", label: "Ready" },
    "handed-off": { bg: "bg-blue-500/10", text: "text-blue-400", label: "Handed Off" },
  };

  const effectiveStatus = handoffStatus === "handed-off" ? "handed-off" : status;
  const badge = badges[effectiveStatus] || badges.provisioned;

  return (
    <span className={`inline-flex rounded-full ${badge.bg} px-2 py-1 text-xs ${badge.text}`}>
      {badge.label}
    </span>
  );
}

// ============================================================================
// HEALTH BADGE
// ============================================================================

type HealthStatus = "active" | "limited" | "suspended" | "in-appeal" | "banned" | "unknown" | string;

interface HealthBadgeProps {
  health: HealthStatus;
}

export function HealthBadge({ health }: HealthBadgeProps) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Active" },
    limited: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Limited" },
    suspended: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Suspended" },
    "in-appeal": { bg: "bg-amber-500/20", text: "text-amber-400", label: "In Appeal" },
    banned: { bg: "bg-red-500/20", text: "text-red-400", label: "Banned" },
    unknown: { bg: "bg-slate-500/20", text: "text-slate-400", label: "Unknown" },
  };

  const badge = badges[health] || badges.unknown;

  return (
    <span className={`inline-flex rounded-full ${badge.bg} px-2 py-1 text-xs ${badge.text}`}>
      {badge.label}
    </span>
  );
}

// ============================================================================
// BILLING BADGE
// ============================================================================

type BillingStatus = "not_started" | "verified" | "pending" | "failed" | string;

interface BillingBadgeProps {
  status: BillingStatus;
}

export function BillingBadge({ status }: BillingBadgeProps) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    not_started: { bg: "bg-slate-500/20", text: "text-slate-400", label: "Not Started" },
    verified: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Verified" },
    pending: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Pending" },
    failed: { bg: "bg-red-500/20", text: "text-red-400", label: "Failed" },
  };

  const badge = badges[status] || badges.pending;

  return (
    <span className={`inline-flex rounded-full ${badge.bg} px-2 py-1 text-xs ${badge.text}`}>
      {badge.label}
    </span>
  );
}
