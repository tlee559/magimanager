"use client";

import { AutomationsPlaceholder } from "@/lib/kadabra-ui";
import { Eye } from "lucide-react";

export default function AutomationsPage() {
  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-100">Automations</h1>
          <div className="flex items-center gap-1 px-2 py-1 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs text-violet-400">
            <Eye className="w-3 h-3" />
            Monitoring Mode
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Monitor your campaigns with intelligent rules
        </p>
      </div>

      <AutomationsPlaceholder />
    </>
  );
}
