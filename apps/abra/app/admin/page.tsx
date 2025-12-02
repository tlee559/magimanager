"use client";

import { useState, useEffect } from "react";
import { useAbraLayout } from "./abra-layout-provider";
import Link from "next/link";
import { CreditCard, Users, ClipboardList, TrendingUp, AlertCircle, CheckCircle, Clock } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type DashboardStats = {
  totalAccounts: number;
  activeAccounts: number;
  warmingUpAccounts: number;
  readyAccounts: number;
  totalIdentities: number;
  pendingRequests: number;
  recentActivity: {
    id: string;
    action: string;
    details: string;
    createdAt: string;
  }[];
};

// ============================================================================
// DASHBOARD PAGE
// ============================================================================

export default function DashboardPage() {
  const { user, userRole, isLoading: userLoading } = useAbraLayout();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (userLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-slate-800 rounded mb-2" />
          <div className="h-4 w-64 bg-slate-800 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
              <div className="h-4 w-24 bg-slate-800 rounded mb-2" />
              <div className="h-8 w-16 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400">Welcome back, {user?.name || "User"}</p>
      </div>

      {/* Stats Grid - Admin view */}
      {isAdmin && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/accounts" className="group">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-violet-500/50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Accounts</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.totalAccounts}</p>
                </div>
                <CreditCard className="w-8 h-8 text-violet-400" />
              </div>
            </div>
          </Link>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.activeAccounts}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Warming Up</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{stats.warmingUpAccounts}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Ready for Handoff</p>
                <p className="text-2xl font-bold text-cyan-400 mt-1">{stats.readyAccounts}</p>
              </div>
              <Clock className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
        </div>
      )}

      {/* Secondary Stats Row */}
      {isAdmin && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/identities" className="group">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-violet-500/50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Identity Profiles</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.totalIdentities}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </Link>

          <Link href="/admin/requests" className="group">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-violet-500/50 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Pending Requests</p>
                  <p className="text-2xl font-bold text-white mt-1">{stats.pendingRequests}</p>
                </div>
                <ClipboardList className="w-8 h-8 text-orange-400" />
              </div>
              {stats.pendingRequests > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-orange-400">
                  <AlertCircle className="w-3 h-3" />
                  Needs attention
                </div>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Recent Activity */}
      {isAdmin && stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {stats.recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-violet-400 mt-1.5" />
                <div className="flex-1">
                  <p className="text-slate-300">{activity.details}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-admin user view */}
      {!isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Welcome to MagiManager</h2>
          <p className="text-slate-400 mb-4">
            Use the sidebar to navigate to your accounts and requests.
          </p>
          <Link
            href="/admin/my-requests"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition"
          >
            <ClipboardList className="w-4 h-4" />
            View My Requests
          </Link>
        </div>
      )}
    </div>
  );
}
