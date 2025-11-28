"use client";

import type { Identity, AdAccount, AdminView } from "@magimanager/shared";
import {
  SkeletonStatCards,
  SkeletonRecentIdentities,
} from "@/lib/skeleton-loaders";

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

interface DashboardViewProps {
  identities: Identity[];
  accounts: AdAccount[];
  loading: boolean;
  onNavigate: (view: AdminView) => void;
}

export function DashboardView({ identities, accounts, loading, onNavigate }: DashboardViewProps) {
  // Filter out archived items for dashboard stats
  const activeIdentities = identities.filter((i) => !i.archived);
  const activeAccounts = accounts.filter((a) => a.handoffStatus !== "archived");

  const recentIdentities = activeIdentities.slice(0, 4);

  // Compute real metrics (exclude archived)
  const warmingUpCount = activeAccounts.filter((a) => a.status === "warming-up").length;
  const readyCount = activeAccounts.filter((a) => a.status === "ready").length;
  const handedOffCount = activeAccounts.filter((a) => a.handoffStatus === "handed-off").length;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          High-level overview of your Account Factory. See identities, accounts, and warmup status at a glance.
        </p>
        <div className="mt-4 p-3 rounded-lg border border-slate-800 bg-slate-900/40">
          <p className="text-xs font-semibold text-slate-300 mb-2">Current Manual Pipeline We Are Solving:</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <div className="whitespace-nowrap">👤 User creates Identity Profile + Website</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">🔐 User creates GoLogin Profile</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">💳 User creates Ad Account</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">🔥 User warms up Account</div>
            <div className="text-slate-500">→</div>
            <div className="whitespace-nowrap">🤝 User hands off Account to Media Buyer</div>
          </div>
        </div>
      </div>

      {loading ? (
        <>
          <SkeletonStatCards count={4} />
          <div className="mt-10">
            <SkeletonRecentIdentities />
          </div>
        </>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="ID Profiles"
              value={activeIdentities.length}
              description="Stored ID profiles (KYC records)."
              icon="👤"
              color="emerald"
            />
            <StatCard
              title="In Warmup"
              value={warmingUpCount}
              description="Accounts currently warming up."
              icon="⏳"
              color="amber"
            />
            <StatCard
              title="Ready to Deploy"
              value={readyCount}
              description="Warmup complete, ready for handoff."
              icon="✓"
              color="green"
            />
            <StatCard
              title="Handed Off"
              value={handedOffCount}
              description="Assigned to media buyers."
              icon="🚀"
              color="blue"
            />
          </div>

          {/* Recent Identities */}
          {recentIdentities.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">Recent ID Profiles</h2>
                  <p className="text-xs text-slate-400 mt-1">Your most recently created profiles</p>
                </div>
                <button
                  onClick={() => onNavigate("identities")}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  View all →
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {recentIdentities.map((identity) => (
                  <IdentityCard key={identity.id} identity={identity} onClick={() => onNavigate("identities")} />
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-slate-200 mb-2">Quick actions</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                onClick={() => onNavigate("create-identity")}
                className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 transition"
              >
                + New Identity Profile
              </button>
              <button
                onClick={() => onNavigate("identities")}
                className="inline-flex items-center rounded-lg border border-slate-700 px-4 py-2 text-slate-100 hover:bg-slate-800 transition"
              >
                View ID Profiles
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: string;
  color: "emerald" | "amber" | "green" | "blue";
}

function StatCard({ title, value, description, icon, color }: StatCardProps) {
  const colorClasses = {
    emerald: "bg-emerald-500/10",
    amber: "bg-amber-500/10",
    green: "bg-green-500/10",
    blue: "bg-blue-500/10",
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center text-xl`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-semibold text-slate-50 mb-1">{value}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  );
}

// ============================================================================
// IDENTITY CARD COMPONENT
// ============================================================================

interface IdentityCardProps {
  identity: Identity;
  onClick: () => void;
}

function IdentityCard({ identity, onClick }: IdentityCardProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left hover:bg-slate-800/60 hover:border-emerald-500/30 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
          {identity.fullName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-100 truncate">{identity.fullName}</div>
          <div className="text-xs text-slate-400">{identity.geo}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{new Date(identity.createdAt).toLocaleDateString()}</span>
        {identity.documents.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
            {identity.documents.length} docs
          </span>
        )}
      </div>
    </button>
  );
}
