"use client";

import { useRouter } from "next/navigation";
import { AdminRequestsView } from "@magimanager/features/admin";

export default function AdminRequestsPage() {
  const router = useRouter();

  return (
    <div className="max-w-5xl mx-auto">
      <AdminRequestsView
        onApprove={(requestId) => {
          // Navigate to create identity with the request ID
          router.push(`/admin/identities/new?requestId=${requestId}`);
        }}
      />
    </div>
  );
}
