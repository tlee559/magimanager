"use client";

import { useRouter } from "next/navigation";
import { CampaignPlannerView } from "@/lib/campaign-planner-view";
import { createChatWindow } from "@/lib/chat-window-bar";

export default function CampaignPlannerPage() {
  const router = useRouter();

  return (
    <CampaignPlannerView
      onBack={() => router.push("/admin/tools")}
      onOpenChat={(planName, context) => {
        // Create a chat window with campaign plan context
        const newWindow = createChatWindow(null, `Plan: ${planName}`, context);
        // Note: Window won't persist without layout state, but functionality is preserved
        console.log("Open chat for plan:", newWindow);
      }}
    />
  );
}
