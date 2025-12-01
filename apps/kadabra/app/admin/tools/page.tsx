"use client";

import { ToolsView } from "@/lib/kadabra-ui";
import { useRouter } from "next/navigation";

export default function ToolsPage() {
  const router = useRouter();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Tools</h1>
        <p className="text-sm text-slate-500 mt-1">
          Utilities and integrations for account management
        </p>
      </div>

      <ToolsView
        onNavigate={(view) => {
          // Map view names to routes
          if (view === "campaign-planner") {
            router.push("/admin/tools/campaign-planner");
          } else if (view === "video-clipper") {
            router.push("/admin/tools/video-clipper");
          }
        }}
      />
    </>
  );
}
