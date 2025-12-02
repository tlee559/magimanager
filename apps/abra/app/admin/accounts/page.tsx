"use client";

import { AdAccountsView } from "@magimanager/features/admin";

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Profiles</h1>
        <p className="text-slate-400">Manage Google Ads accounts and their lifecycle</p>
      </div>
      <AdAccountsView />
    </div>
  );
}
