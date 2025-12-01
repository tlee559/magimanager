"use client";

import { AccountDetailView } from "@/lib/kadabra-ui";
import { useKadabraLayout } from "../../kadabra-layout-provider";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, Eye } from "lucide-react";
import { formatCid } from "@magimanager/shared";

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accounts, openChatWithContext } = useKadabraLayout();

  const accountId = params.id as string;
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    return (
      <div className="text-slate-400">
        Account not found or still loading...
      </div>
    );
  }

  const accountName = `MM${String(account.internalId).padStart(3, "0")}`;

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
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
        <p className="text-sm text-slate-500 mt-1">
          View campaigns, ad groups, and ads for this account
        </p>
      </div>

      <AccountDetailView
        account={account}
        onOpenAdChat={(prompt, adContext) => {
          const contextWithPrompt = `${adContext}\n\nUser Request: ${prompt}`;
          openChatWithContext(
            account.id,
            account.googleCid ? `Ad Chat (${formatCid(account.googleCid)})` : "Ad Chat",
            contextWithPrompt
          );
        }}
      />
    </>
  );
}
