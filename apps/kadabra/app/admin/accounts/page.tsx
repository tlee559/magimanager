"use client";

import { MyAccountsView } from "@/lib/kadabra-ui";
import { useKadabraLayout } from "../kadabra-layout-provider";
import { useRouter } from "next/navigation";

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, loading, openChatForAccount } = useKadabraLayout();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">My Accounts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your assigned Google Ads accounts
        </p>
      </div>

      <MyAccountsView
        accounts={accounts}
        loading={loading}
        onAccountClick={(accountId) => {
          router.push(`/admin/accounts/${accountId}`);
        }}
        onChatAboutAccount={(account) => {
          openChatForAccount(account);
        }}
      />
    </>
  );
}
