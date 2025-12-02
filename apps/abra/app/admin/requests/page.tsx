"use client";

import { useState, useEffect } from "react";
import { useAbraLayout } from "../abra-layout-provider";
import { Inbox, CheckCircle, XCircle, Clock, Eye } from "lucide-react";

type AccountRequest = {
  id: string;
  type: string;
  quantity: number;
  geo: string;
  notes: string | null;
  status: string;
  requestedBy: {
    id: string;
    name: string;
    email: string;
  };
  reviewedBy?: {
    name: string;
  } | null;
  createdAt: string;
  reviewedAt: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

export default function RequestsPage() {
  const { userRole } = useAbraLayout();
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch("/api/requests");
        if (res.ok) {
          const data = await res.json();
          setRequests(data.requests || data);
        }
      } catch (error) {
        console.error("Failed to fetch requests:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequests();
  }, []);

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "MANAGER";

  if (!isAdmin) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400">You don't have permission to view account requests.</p>
      </div>
    );
  }

  const filteredRequests = requests.filter((request) =>
    filter === "all" ? true : request.status === filter
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Account Requests</h1>
          <p className="text-slate-400">Review and manage incoming account requests</p>
        </div>
        {pendingCount > 0 && (
          <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <span className="text-amber-400 text-sm font-medium">{pendingCount} pending</span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === status
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/30"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Inbox className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Requests</h2>
          <p className="text-slate-400">
            {filter === "all"
              ? "No account requests have been submitted yet."
              : `No ${filter} requests.`}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Request</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Requested By</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-white font-medium">
                        {request.quantity} {request.type} Account{request.quantity > 1 ? "s" : ""}
                      </div>
                      <div className="text-sm text-slate-500">Geo: {request.geo}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-300">{request.requestedBy.name}</div>
                    <div className="text-sm text-slate-500">{request.requestedBy.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[request.status]}`}>
                      {request.status === "pending" && <Clock className="w-3 h-3" />}
                      {request.status === "approved" && <CheckCircle className="w-3 h-3" />}
                      {request.status === "rejected" && <XCircle className="w-3 h-3" />}
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-violet-400 hover:text-violet-300 transition">
                      <Eye className="w-4 h-4" />
                      View
                    </button>
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
