"use client";

import { useState, useEffect } from "react";
import { useAbraLayout } from "../abra-layout-provider";
import { ClipboardList, Plus, CheckCircle, XCircle, Clock } from "lucide-react";

type MyRequest = {
  id: string;
  type: string;
  quantity: number;
  geo: string;
  notes: string | null;
  status: string;
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

export default function MyRequestsPage() {
  const { user } = useAbraLayout();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);

  useEffect(() => {
    async function fetchMyRequests() {
      try {
        const res = await fetch("/api/requests/mine");
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

    fetchMyRequests();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Requests</h1>
          <p className="text-slate-400">Track your account requests</p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-800 rounded" />
            ))}
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">No Requests Yet</h2>
          <p className="text-slate-400 mb-4">
            Submit a request to get new ad accounts assigned to you.
          </p>
          <button
            onClick={() => setShowNewRequest(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition"
          >
            <Plus className="w-4 h-4" />
            Create Request
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">
                    {request.quantity} {request.type} Account{request.quantity > 1 ? "s" : ""}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">Geo: {request.geo}</p>
                  {request.notes && (
                    <p className="text-sm text-slate-500 mt-2">{request.notes}</p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${STATUS_COLORS[request.status]}`}>
                  {request.status === "pending" && <Clock className="w-3 h-3" />}
                  {request.status === "approved" && <CheckCircle className="w-3 h-3" />}
                  {request.status === "rejected" && <XCircle className="w-3 h-3" />}
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-800 text-sm text-slate-500">
                <span>Requested: {new Date(request.createdAt).toLocaleDateString()}</span>
                {request.reviewedAt && (
                  <span>
                    Reviewed: {new Date(request.reviewedAt).toLocaleDateString()}
                    {request.reviewedBy && ` by ${request.reviewedBy.name}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Request Modal - placeholder */}
      {showNewRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">New Account Request</h2>
            <p className="text-slate-400 mb-4">Request form coming soon...</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewRequest(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
