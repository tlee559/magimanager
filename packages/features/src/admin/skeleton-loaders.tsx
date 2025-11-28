"use client";

// ============================================================================
// SKELETON LOADER COMPONENTS
// Reusable skeleton components for loading states throughout the app
// ============================================================================

// Base skeleton element with shimmer animation
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-800 rounded ${className}`}
    />
  );
}

// Skeleton for stat cards on dashboard
export function SkeletonStatCard() {
  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-12 w-12 rounded-lg" />
      </div>
    </div>
  );
}

// Skeleton for a row of stat cards
export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

// Skeleton for table rows
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-t border-slate-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Skeleton for multiple table rows
export function SkeletonTableRows({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </>
  );
}

// Skeleton for identity list table
export function SkeletonIdentitiesTable() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900 border-b border-slate-800">
          <tr>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Name</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Location</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Created</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Docs</th>
            <th className="text-right p-4 text-xs font-semibold text-slate-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              </td>
              <td className="p-4"><Skeleton className="h-4 w-24" /></td>
              <td className="p-4"><Skeleton className="h-4 w-20" /></td>
              <td className="p-4"><Skeleton className="h-6 w-6 rounded-full" /></td>
              <td className="p-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Skeleton for accounts table
export function SkeletonAccountsTable() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900 border-b border-slate-800">
          <tr>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">CID</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Identity</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Warmup</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Health</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Billing</th>
            <th className="text-right p-4 text-xs font-semibold text-slate-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="p-4"><Skeleton className="h-4 w-24" /></td>
              <td className="p-4"><Skeleton className="h-4 w-32" /></td>
              <td className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
              <td className="p-4">
                <div className="space-y-1">
                  <Skeleton className="h-2 w-24 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </td>
              <td className="p-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
              <td className="p-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
              <td className="p-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Skeleton for team member table
export function SkeletonTeamTable() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900 border-b border-slate-800">
          <tr>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Name</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Email</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Role</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Accounts</th>
            <th className="text-left p-4 text-xs font-semibold text-slate-400 uppercase">Last Login</th>
            <th className="text-right p-4 text-xs font-semibold text-slate-400 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i}>
              <td className="p-4"><Skeleton className="h-4 w-28" /></td>
              <td className="p-4"><Skeleton className="h-4 w-40" /></td>
              <td className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
              <td className="p-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
              <td className="p-4"><Skeleton className="h-4 w-20" /></td>
              <td className="p-4"><Skeleton className="h-4 w-24" /></td>
              <td className="p-4 text-right">
                <div className="flex gap-3 justify-end">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Skeleton for dashboard recent identities
export function SkeletonRecentIdentities() {
  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6">
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton for operations dashboard spreadsheet
export function SkeletonOperationsTable() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
          <tr>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase w-8">
              <Skeleton className="h-4 w-4" />
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">CID</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Identity</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Health</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Billing</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Cert</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Daily $</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Total $</th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase">Last Check</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="px-3 py-2"><Skeleton className="h-4 w-4 rounded" /></td>
              <td className="px-3 py-2"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
              <td className="px-3 py-2"><Skeleton className="h-5 w-5 rounded" /></td>
              <td className="px-3 py-2"><Skeleton className="h-5 w-5 rounded" /></td>
              <td className="px-3 py-2"><Skeleton className="h-5 w-5 rounded" /></td>
              <td className="px-3 py-2"><Skeleton className="h-4 w-12" /></td>
              <td className="px-3 py-2"><Skeleton className="h-4 w-14" /></td>
              <td className="px-3 py-2"><Skeleton className="h-4 w-20" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Skeleton for needs attention alerts
export function SkeletonAlertCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
          <div className="flex items-start justify-between mb-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for detail panel timeline
export function SkeletonTimeline() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for check-in history
export function SkeletonCheckInHistory() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for notifications list
export function SkeletonNotifications() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for settings form
export function SkeletonSettingsForm() {
  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-6">
      <div>
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-3 w-48 mt-1" />
      </div>
      <div>
        <Skeleton className="h-4 w-28 mb-2" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div>
        <Skeleton className="h-4 w-36 mb-2" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

// Skeleton for identity detail view
export function SkeletonIdentityDetail() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>

      {/* Documents Section */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6">
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Generic loading spinner
export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <svg
      className={`animate-spin text-emerald-500 ${sizeClasses[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Full page loading state
export function PageLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
