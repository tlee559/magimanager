"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccountDetailView, CardSkeleton, type AdAccount } from "@/lib/kadabra-ui";
import { useKadabraLayout } from "../../layout";
import { ChevronRight, Eye } from "lucide-react";
import { createChatWindow } from "@/lib/chat-window-bar";
import { formatCid } from "@magimanager/shared";

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<AdAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchAccount();
    }
  }, [id]);

  async function fetchAccount() {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/my-accounts");
      if (res.ok) {
        const data = await res.json();
        const accounts = Array.isArray(data) ? data : data.accounts || [];
        const foundAccount = accounts.find((a: AdAccount) => a.id === id);
        setAccount(foundAccount || null);
      }
    } catch (error) {
      console.error("Failed to fetch account:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 animate-pulse">
          <div className="h-6 bg-slate-700/50 rounded w-1/4 mb-4" />
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-3">
                <div className="h-3 bg-slate-700/50 rounded w-1/2 mb-2" />
                <div className="h-5 bg-slate-700/50 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 h-96 animate-pulse" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
        <h3 className="text-lg font-medium text-slate-200 mb-2">Account Not Found</h3>
        <p className="text-sm text-slate-500 mb-4">
          The account you're looking for doesn't exist or you don't have access to it.
        </p>
        <button
          onClick={() => router.push("/admin/accounts")}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition"
        >
          Back to My Accounts
        </button>
      </div>
    );
  }

  const accountName = `MM${String(account.internalId).padStart(3, "0")}`;

  return (
    <div>
      {/* Custom Header with Back Button */}
      <div className="flex items-center gap-3 mb-6 -mt-6">
        <button
          onClick={() => router.push("/admin/accounts")}
          className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-400"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-slate-100">{accountName}</h1>
        <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
          <Eye className="w-3 h-3" />
          Read-only
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-6 -mt-4">
        View campaigns, ad groups, and ads for this account
      </p>

      <AccountDetailView
        account={account}
        onOpenAdChat={(prompt, adContext) => {
          // Open chat with ad context
          const contextWithPrompt = `${adContext}\n\nUser Request: ${prompt}`;
          const newWindow = createChatWindow(
            account?.id || null,
            account?.googleCid ? `Ad Chat (${formatCid(account.googleCid)})` : "Ad Chat",
            contextWithPrompt
          );
          // Note: This doesn't add to layout state, but the functionality is preserved
          console.log("Open chat:", newWindow);
        }}
      />
    </div>
  );
}
