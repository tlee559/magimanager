"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

/**
 * Logout page for Abra
 *
 * This page handles proper session cleanup:
 * 1. Clears cookies for both the current domain and .magimanager.com
 * 2. Calls NextAuth signOut
 * 3. Redirects to the central login portal's logout page
 */

function clearAllAuthCookies() {
  // Cookie names to clear
  const cookieNames = [
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.callback-url",
    "next-auth.callback-url",
    "__Secure-next-auth.csrf-token",
    "next-auth.csrf-token",
    "auth_redirect_count",
  ];

  // Domains to clear from
  const domains = [
    ".magimanager.com",
    "magimanager.com",
    "abra.magimanager.com",
    window.location.hostname,
  ];

  // Clear each cookie for each domain
  cookieNames.forEach((name) => {
    domains.forEach((domain) => {
      // Clear with domain
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
      // Clear without domain (current host only)
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });
}

export default function LogoutPage() {
  const { status } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(true);

  useEffect(() => {
    const performLogout = async () => {
      // First, clear all auth cookies manually
      clearAllAuthCookies();

      // Then call NextAuth signOut
      if (status === "authenticated") {
        await signOut({ redirect: false });
      }

      // Clear cookies again after signOut (belt and suspenders)
      clearAllAuthCookies();

      // Redirect to central login portal's logout page with origin info
      const loginUrl = process.env.NEXT_PUBLIC_LOGIN_URL || "https://login.magimanager.com";
      const abraUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";

      // Small delay to ensure cookies are cleared
      setTimeout(() => {
        setIsLoggingOut(false);
        // Pass origin so after re-login, user returns to Abra
        window.location.href = `${loginUrl}/logout?origin=${encodeURIComponent(abraUrl)}`;
      }, 500);
    };

    performLogout();
  }, [status]);

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-300 font-medium">
          {isLoggingOut ? "Signing you out..." : "Redirecting..."}
        </p>
      </div>
    </main>
  );
}
