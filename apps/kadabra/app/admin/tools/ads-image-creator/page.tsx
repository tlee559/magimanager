"use client";

import { AdsImageCreatorView } from "@/lib/ads-image-creator-view";
import { useRouter } from "next/navigation";

export default function AdsImageCreatorPage() {
  const router = useRouter();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">AI Ads Image Creator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate high-converting ad creatives with AI
        </p>
      </div>

      <AdsImageCreatorView onBack={() => router.push("/admin/tools")} />
    </>
  );
}
