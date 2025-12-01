"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CreateIdentityView, LoadingSpinner } from "@magimanager/features/admin";

function CreateIdentityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");

  return (
    <div className="max-w-5xl mx-auto">
      <CreateIdentityView
        onSuccess={() => router.push("/admin/identities")}
        onCancel={() => router.push("/admin/identities")}
        requestId={requestId}
      />
    </div>
  );
}

export default function CreateIdentityPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><LoadingSpinner /></div>}>
      <CreateIdentityContent />
    </Suspense>
  );
}
