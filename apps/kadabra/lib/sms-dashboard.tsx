"use client";

import { useState, useEffect, useCallback } from "react";

type Verification = {
  id: string;
  fullName: string;
  verificationPhone: string | null;
  verificationPhoneId: string | null;
  verificationStatus: string | null;
  verificationCode: string | null;
  verificationExpiresAt: Date | null;
  updatedAt: Date;
  adAccounts: { id: string; internalId: number; googleCid: string | null }[];
};

type Stats = {
  activeCount: number;
  receivedCount: number;
  expiredCount: number;
  totalWithVerification: number;
};

type SMSDashboardProps = {
  onNavigateToIdentity?: (id: string) => void;
};

export function SMSDashboard({ onNavigateToIdentity }: SMSDashboardProps) {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async (includeBalance = false) => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (includeBalance) params.set("includeBalance", "true");

      const res = await fetch(`/api/verifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVerifications(data.verifications || []);
        setStats(data.stats || null);
        if (data.balance !== undefined) {
          setBalance(data.balance);
        }
      }
    } catch (error) {
      console.error("Failed to fetch verifications:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    setLoading(true);
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCheckAll = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-all" }),
      });
      if (res.ok) {
        await fetchData(true);
      }
    } catch (error) {
      console.error("Failed to check verifications:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleClearExpired = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-expired" }),
      });
      if (res.ok) {
        await fetchData(true);
      }
    } catch (error) {
      console.error("Failed to clear expired:", error);
    } finally {
      setClearing(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "-";
    // Format: +1 (XXX) XXX-XXXX
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getTimeRemaining = (expiresAt: Date | null) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getStatusBadge = (status: string | null, expiresAt: Date | null) => {
    // Check if actually expired
    if (status === "pending" && expiresAt && new Date(expiresAt) <= new Date()) {
      return (
        <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">
          Expired
        </span>
      );
    }

    switch (status) {
      case "pending":
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">
            Pending
          </span>
        );
      case "received":
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
            Received
          </span>
        );
      case "expired":
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">
            Expired
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">
            -
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Beta Banner */}
      <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <p className="text-sm text-amber-400">
          <span className="font-semibold">BETA:</span> SMS Verification is currently in beta. Features may change.
        </p>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Active</div>
          <div className="text-2xl font-bold text-amber-400">{stats?.activeCount ?? "-"}</div>
          <div className="text-xs text-slate-500">Pending verifications</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Received</div>
          <div className="text-2xl font-bold text-emerald-400">{stats?.receivedCount ?? "-"}</div>
          <div className="text-xs text-slate-500">Codes ready</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Expired</div>
          <div className="text-2xl font-bold text-slate-400">{stats?.expiredCount ?? "-"}</div>
          <div className="text-xs text-slate-500">Needs cleanup</div>
        </div>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Balance</div>
          <div className={`text-2xl font-bold ${balance !== null && balance < 10 ? "text-red-400" : "text-slate-100"}`}>
            {balance !== null ? `$${balance.toFixed(2)}` : "-"}
          </div>
          <div className="text-xs text-slate-500">TextVerified</div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="received">Received</option>
          <option value="expired">Expired</option>
        </select>

        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2">
          <button
            onClick={handleCheckAll}
            disabled={checking || loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            {checking ? "Checking..." : "Check All"}
          </button>
          <button
            onClick={handleClearExpired}
            disabled={clearing || loading || (stats?.expiredCount ?? 0) === 0}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm rounded-lg transition-colors"
          >
            {clearing ? "Clearing..." : "Clear Expired"}
          </button>
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-sm rounded-lg transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Identity</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Expires</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : verifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No verifications found
                  </td>
                </tr>
              ) : (
                verifications.map((v) => (
                  <tr key={v.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onNavigateToIdentity?.(v.id)}
                        className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {v.fullName}
                      </button>
                      {v.adAccounts.length > 0 && (
                        <div className="text-xs text-slate-500">
                          {v.adAccounts.length} account{v.adAccounts.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-300 font-mono">
                          {formatPhone(v.verificationPhone)}
                        </span>
                        {v.verificationPhone && (
                          <button
                            onClick={() => handleCopy(v.verificationPhone!, `phone-${v.id}`)}
                            className="text-slate-500 hover:text-slate-300 text-xs"
                            title="Copy phone"
                          >
                            {copiedId === `phone-${v.id}` ? "✓" : "📋"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(v.verificationStatus, v.verificationExpiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      {v.verificationCode ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-emerald-400 font-mono font-bold">
                            {v.verificationCode}
                          </span>
                          <button
                            onClick={() => handleCopy(v.verificationCode!, `code-${v.id}`)}
                            className="text-slate-500 hover:text-slate-300 text-xs"
                            title="Copy code"
                          >
                            {copiedId === `code-${v.id}` ? "✓" : "📋"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.verificationStatus === "pending" && v.verificationExpiresAt ? (
                        <span className={`text-sm font-mono ${
                          getTimeRemaining(v.verificationExpiresAt) === "Expired"
                            ? "text-slate-500"
                            : "text-amber-400"
                        }`}>
                          {getTimeRemaining(v.verificationExpiresAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onNavigateToIdentity?.(v.id)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-4 text-xs text-slate-500 text-center">
        Auto-refreshes every 30 seconds • {verifications.length} verification{verifications.length !== 1 ? "s" : ""} shown
      </div>
    </div>
  );
}
