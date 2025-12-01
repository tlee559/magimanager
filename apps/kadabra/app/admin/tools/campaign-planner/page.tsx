"use client";

import { CampaignPlannerView } from "@/lib/campaign-planner-view";
import { useKadabraLayout } from "../../kadabra-layout-provider";
import { useRouter } from "next/navigation";

export default function CampaignPlannerPage() {
  const router = useRouter();
  const { openChatWithContext } = useKadabraLayout();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Campaign Planner AI</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create AI-powered campaign plans with keywords and ad copy
        </p>
      </div>

      <CampaignPlannerView
        onBack={() => router.push("/admin/tools")}
        onOpenChat={(planName, context) => {
          openChatWithContext(null, `Plan: ${planName}`, context);
        }}
      />
    </>
  );
}
