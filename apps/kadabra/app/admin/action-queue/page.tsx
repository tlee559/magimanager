"use client";

import { ActionQueueView } from "@/lib/kadabra-ui";

export default function ActionQueuePage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Action Queue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Copy-paste ready fixes to apply in Google Ads
        </p>
      </div>

      <ActionQueueView />
    </>
  );
}
