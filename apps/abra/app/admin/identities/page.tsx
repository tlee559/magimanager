"use client";

import { useState, useEffect } from "react";
import { useAbraLayout } from "../abra-layout-provider";
import Link from "next/link";
import { Users, Plus, Search, Archive, Eye } from "lucide-react";

type Identity = {
  id: string;
  fullName: string;
  email: string | null;
  geo: string;
  archived: boolean;
  createdAt: string;
  _count: {
    adAccounts: number;
  };
};

export default function IdentitiesPage() {
  const { userRole } = useAbraLayout();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    async function fetchIdentities() {
      try {
        const res = await fetch(`/api/identities?includeArchived=${showArchived}`);
        if (res.ok) {
          const data = await res.json();
          setIdentities(data.identities || data);
        }
      } catch (error) {
        console.error("Failed to fetch identities:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchIdentities();
  }, [showArchived]);

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER";

  const filteredIdentities = identities.filter((identity) =>
    identity.fullName.toLowerCase().includes(search.toLowerCase()) ||
    identity.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400">You don't have permission to view identity profiles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Identity Profiles</h1>
          <p className="text-slate-400">Manage identity profiles for account creation</p>
        </div>
        <Link
          href="/admin/identities/new"
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition"
        >
          <Plus className="w-4 h-4" />
          New Identity
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search identities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
            showArchived
              ? "bg-violet-500/10 border-violet-500/50 text-violet-400"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
          }`}
        >
          <Archive className="w-4 h-4" />
          {showArchived ? "Showing Archived" : "Show Archived"}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      ) : filteredIdentities.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Identities Found</h2>
          <p className="text-slate-400 mb-4">
            {search ? "No identities match your search." : "Get started by creating your first identity profile."}
          </p>
          {!search && (
            <Link
              href="/admin/identities/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition"
            >
              <Plus className="w-4 h-4" />
              Create Identity
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Geo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Accounts</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIdentities.map((identity) => (
                <tr key={identity.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{identity.fullName}</span>
                      {identity.archived && (
                        <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">Archived</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{identity.email || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{identity.geo}</td>
                  <td className="px-4 py-3 text-slate-400">{identity._count?.adAccounts || 0}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(identity.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/identities/${identity.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-violet-400 hover:text-violet-300 transition"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
