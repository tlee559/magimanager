"use client";

import { useRouter } from "next/navigation";
import { ToolsView } from "@/lib/kadabra-ui";

export default function ToolsPage() {
  const router = useRouter();

  // Map old view names to new routes
  function handleNavigate(view: string) {
    if (view === "campaign-planner") {
      router.push("/admin/tools/campaign-planner");
    } else if (view === "video-clipper") {
      router.push("/admin/tools/video-clipper");
    }
  }

  return <ToolsView onNavigate={handleNavigate} />;
}
