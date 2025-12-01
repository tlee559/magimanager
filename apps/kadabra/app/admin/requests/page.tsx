"use client";

import { RequestsView } from "@/lib/kadabra-ui";
import { useKadabraLayout } from "../kadabra-layout-provider";

export default function RequestsPage() {
  const { requests, loading, setShowRequestModal } = useKadabraLayout();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Account Requests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Request new accounts or claim existing ones
        </p>
      </div>

      <RequestsView
        requests={requests}
        loading={loading}
        onCreateRequest={() => setShowRequestModal(true)}
      />
    </>
  );
}
