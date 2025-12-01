"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { EditIdentityView, SkeletonIdentityDetail } from "@magimanager/features/admin";

export default function EditIdentityPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [identity, setIdentity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchIdentity(id);
    }
  }, [id]);

  async function fetchIdentity(identityId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/identities/${identityId}`);
      if (res.ok) {
        const data = await res.json();
        setIdentity(data);
      } else {
        // Identity not found - redirect to list
        router.push("/admin/identities");
      }
    } catch (error) {
      console.error("Failed to fetch identity:", error);
      router.push("/admin/identities");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <SkeletonIdentityDetail />
      </div>
    );
  }

  if (!identity) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <EditIdentityView
        identity={identity}
        onSuccess={() => router.push(`/admin/identities/${id}`)}
        onCancel={() => router.push(`/admin/identities/${id}`)}
      />
    </div>
  );
}
