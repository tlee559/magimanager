"use client";

import { useState, useEffect } from "react";
import { useAbraLayout } from "../abra-layout-provider";
import { Settings, Save, AlertCircle } from "lucide-react";

type AppSettings = {
  id: string;
  warmupTargetSpend: number;
  updatedAt: string;
};

export default function SettingsPage() {
  const { userRole } = useAbraLayout();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [warmupTarget, setWarmupTarget] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          setWarmupTarget((data.warmupTargetSpend / 100).toString());
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warmupTargetSpend: Math.round(parseFloat(warmupTarget) * 100),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setMessage({ type: "success", text: "Settings saved successfully!" });
      } else {
        setMessage({ type: "error", text: "Failed to save settings." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred while saving." });
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Settings className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Access Restricted</h2>
        <p className="text-slate-400">You don't have permission to modify settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">Configure application settings</p>
      </div>

      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-slate-800 rounded" />
            <div className="h-10 w-full bg-slate-800 rounded" />
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Account Warmup Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Default Warmup Target Spend ($)
              </label>
              <input
                type="number"
                value={warmupTarget}
                onChange={(e) => setWarmupTarget(e.target.value)}
                step="0.01"
                min="0"
                className="w-full max-w-xs px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
              <p className="text-sm text-slate-500 mt-1">
                Accounts will be marked as "ready" when they reach this spend threshold.
              </p>
            </div>

            {message && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              }`}>
                <AlertCircle className="w-4 h-4" />
                {message.text}
              </div>
            )}

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>

          {settings && (
            <p className="text-xs text-slate-500 mt-4">
              Last updated: {new Date(settings.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
