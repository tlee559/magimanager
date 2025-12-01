"use client";

import { useRouter } from "next/navigation";
import { AdAccountsView } from "@magimanager/features/admin";

export default function AdAccountsPage() {
  const router = useRouter();

  return (
    <AdAccountsView
      onDataChange={() => {
        // Refresh data - the view handles this internally
      }}
      onNavigate={(view) => {
        // Map old view names to new routes
        const routes: Record<string, string> = {
          "dashboard": "/admin",
          "identities": "/admin/identities",
          "ad-accounts": "/admin/ad-accounts",
        };
        if (routes[view]) {
          router.push(routes[view]);
        }
      }}
    />
  );
}
