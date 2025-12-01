"use client";

import { useState, useEffect, FormEvent } from "react";
import { useModal } from "@magimanager/features/admin";
import {
  Skeleton,
  SkeletonSettingsForm,
} from "@magimanager/features/admin";

// ============================================================================
// TYPES
// ============================================================================

type AppSettings = {
  id: string;
  warmupTargetSpend: number;
  updatedAt: Date;
  gologinApiKey?: string;
  googleAdsApiKey?: string;
  googleApiKey?: string;
  textverifiedApiKey?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
};

// ============================================================================
// SETTINGS PAGE
// ============================================================================

export default function SettingsPage() {
  const { showSuccess, showError } = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [gologinApiKey, setGologinApiKey] = useState<string>("");
  const [googleAdsApiKey, setGoogleAdsApiKey] = useState<string>("");
  const [googleApiKey, setGoogleApiKey] = useState<string>("");
  const [textverifiedApiKey, setTextverifiedApiKey] = useState<string>("");
  const [telegramBotToken, setTelegramBotToken] = useState<string>("");
  const [telegramChatId, setTelegramChatId] = useState<string>("");
  // Visibility toggles for API keys
  const [showGologinKey, setShowGologinKey] = useState(false);
  const [showGoogleAdsKey, setShowGoogleAdsKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showTextverifiedKey, setShowTextverifiedKey] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setGologinApiKey(data.gologinApiKey || "");
        setGoogleAdsApiKey(data.googleAdsApiKey || "");
        setGoogleApiKey(data.googleApiKey || "");
        setTextverifiedApiKey(data.textverifiedApiKey || "");
        setTelegramBotToken(data.telegramBotToken || "");
        setTelegramChatId(data.telegramChatId || "");
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gologinApiKey,
          googleAdsApiKey,
          googleApiKey,
          textverifiedApiKey,
          telegramBotToken,
          telegramChatId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        await showSuccess("Settings Saved", "Settings saved successfully!");
      } else {
        const data = await res.json();
        await showError("Save Failed", "Failed to save settings: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Save error:", error);
      await showError("Network Error", "Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Skeleton className="h-4 w-96" />
        </div>
        <SkeletonSettingsForm />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Configure application settings. Changes will affect new account creation and warmup behavior.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="max-w-2xl space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-100 mb-4">
            API Keys
          </h2>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                GoLogin API Key
              </label>
              <div className="relative">
                <input
                  type={showGologinKey ? "text" : "password"}
                  value={gologinApiKey}
                  onChange={(e) => setGologinApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter GoLogin API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGologinKey(!showGologinKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showGologinKey ? "Hide" : "Show"}
                >
                  {showGologinKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                API key for GoLogin browser profile management
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Google Ads API Key
              </label>
              <div className="relative">
                <input
                  type={showGoogleAdsKey ? "text" : "password"}
                  value={googleAdsApiKey}
                  onChange={(e) => setGoogleAdsApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter Google Ads API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleAdsKey(!showGoogleAdsKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showGoogleAdsKey ? "Hide" : "Show"}
                >
                  {showGoogleAdsKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                API key for Google Ads account management
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Google API Key
              </label>
              <div className="relative">
                <input
                  type={showGoogleKey ? "text" : "password"}
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter Google API key"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showGoogleKey ? "Hide" : "Show"}
                >
                  {showGoogleKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                General Google API key for various Google services
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                TextVerified API Key
              </label>
              <div className="relative">
                <input
                  type={showTextverifiedKey ? "text" : "password"}
                  value={textverifiedApiKey}
                  onChange={(e) => setTextverifiedApiKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter TextVerified API key"
                />
                <button
                  type="button"
                  onClick={() => setShowTextverifiedKey(!showTextverifiedKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showTextverifiedKey ? "Hide" : "Show"}
                >
                  {showTextverifiedKey ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                API key for TextVerified phone verification (non-VoIP numbers for Google Ads)
              </p>
            </div>
          </div>
        </div>

        {/* Telegram Bot Settings */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Telegram Notifications
            </h2>
            <div className="group relative">
              <span className="text-slate-400 cursor-help text-sm">ⓘ</span>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-lg text-xs text-slate-300 z-10">
                <p className="font-medium text-slate-100 mb-2">How to create a Telegram Bot:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Telegram and search for <span className="text-emerald-400">@BotFather</span></li>
                  <li>Send <span className="font-mono bg-slate-900 px-1 rounded">/newbot</span> and follow the prompts</li>
                  <li>Copy the bot token provided</li>
                  <li>Add your bot to a group or start a chat with it</li>
                  <li>Get your Chat ID using <span className="text-emerald-400">@userinfobot</span></li>
                </ol>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Telegram Bot Token
              </label>
              <div className="relative">
                <input
                  type={showTelegramToken ? "text" : "password"}
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                />
                <button
                  type="button"
                  onClick={() => setShowTelegramToken(!showTelegramToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  title={showTelegramToken ? "Hide" : "Show"}
                >
                  {showTelegramToken ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bot token from @BotFather (format: 123456789:ABC...)
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Telegram Chat ID
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="-1001234567890"
              />
              <p className="text-xs text-slate-500 mt-1">
                Chat or group ID where notifications will be sent (use @userinfobot to find it)
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {settings && (
          <p className="text-xs text-slate-500">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}
      </form>

      {/* Integration Tools Section */}
      <div className="mt-8 max-w-2xl rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-slate-100 mb-4">
          Integration Tools
        </h2>

        <div className="space-y-4">
          {/* Bookmarklet */}
          <div>
            <h3 className="text-sm font-medium text-slate-200 mb-2">
              Connect to MagiManager Bookmarklet
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Drag this button to your bookmarks bar. When on any Google Ads page, click it to connect that account to MagiManager via OAuth.
            </p>

            <div className="flex items-center gap-4">
              <a
                href="javascript:(function(){var cid=location.href.match(/\/(\d{3}-\d{3}-\d{4})\//)?.[1]||document.querySelector('[data-customer-id]')?.dataset.customerId;if(cid){var w=600,h=700,l=(screen.width-w)/2,t=(screen.height-h)/2;window.open('https://abra.magimanager.com/api/oauth/google-ads/authorize?cid='+cid.replace(/-/g,''),'oauth','width='+w+',height='+h+',left='+l+',top='+t);}else{alert('Could not detect CID. Make sure you are on a Google Ads account page.');}})();"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-semibold text-sm cursor-move hover:bg-emerald-400 transition"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Drag this button to your bookmarks bar to install it. Don\'t click it here!');
                }}
                draggable
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                </svg>
                Connect to MagiManager
              </a>

              <span className="text-xs text-slate-500">← Drag to bookmarks bar</span>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-700">
              <p className="text-xs font-medium text-slate-300 mb-2">How to use:</p>
              <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                <li>Drag the green button above to your bookmarks bar</li>
                <li>Open a Google Ads account page in any browser</li>
                <li>Click the bookmarklet in your bookmarks bar</li>
                <li>Approve OAuth access in the popup</li>
                <li>Account is now connected and syncing!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
