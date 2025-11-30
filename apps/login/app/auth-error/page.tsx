"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

function MagiManagerLogo({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="16" fill="url(#logoGradientError)" />
      <path
        d="M25 70V30H35L50 55L65 30H75V70H65V45L50 70L35 45V70H25Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="logoGradientError"
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function clearAllCookies() {
  // Clear all cookies for this domain and parent domain
  const domains = [window.location.hostname, ".magimanager.com"];
  const paths = ["/"];

  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    domains.forEach((domain) => {
      paths.forEach((path) => {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
      });
    });
  });
}

export default function AuthErrorPage() {
  const handleClearAndRetry = () => {
    clearAllCookies();
    // Small delay to ensure cookies are cleared
    setTimeout(() => {
      window.location.href = "https://login.magimanager.com";
    }, 100);
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <MagiManagerLogo size={72} />
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl shadow-slate-950/50">
          {/* Warning icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
            </div>
          </div>

          {/* Message */}
          <h1 className="text-xl font-semibold text-slate-100 mb-2">
            Authentication Error
          </h1>

          <p className="text-slate-400 text-sm mb-6">
            There was a problem with your login session. This can happen if your
            session expired or there was a configuration issue.
          </p>

          <p className="text-slate-500 text-xs mb-8">
            Click below to clear your session and try logging in again.
          </p>

          {/* Clear and retry button */}
          <button
            onClick={handleClearAndRetry}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <RefreshCw className="w-4 h-4" />
            Clear Session & Try Again
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8">
          <p className="text-xs text-slate-500">
            If this problem persists, please contact support.
          </p>
        </div>
      </div>
    </main>
  );
}
