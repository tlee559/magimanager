"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IdentitiesListView, SkeletonIdentitiesTable } from "@magimanager/features/admin";

export default function IdentitiesPage() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIdentities();
  }, []);

  async function fetchIdentities() {
    setLoading(true);
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data.identities || []);
      }
    } catch (error) {
      console.error("Failed to fetch identities:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <SkeletonIdentitiesTable />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <IdentitiesListView
        identities={identities}
        loading={loading}
        onCreateNew={() => router.push("/admin/identities/new")}
        onSelectIdentity={(id) => router.push(`/admin/identities/${id}`)}
      />
    </div>
  );
}
