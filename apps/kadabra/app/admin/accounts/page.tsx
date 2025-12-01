"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MyAccountsView, CardSkeleton, type AdAccount } from "@/lib/kadabra-ui";
import { useKadabraLayout } from "../layout";

export default function AccountsPage() {
  const router = useRouter();
  const layoutContext = useKadabraLayout();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/my-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : data.accounts || []);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <MyAccountsView
      accounts={accounts}
      loading={loading}
      onAccountClick={(accountId) => {
        router.push(`/admin/accounts/${accountId}`);
      }}
      onChatAboutAccount={(account) => {
        layoutContext?.openChatForAccount(account);
      }}
    />
  );
}
