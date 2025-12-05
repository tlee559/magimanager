"use client";

import { useEffect, useState, Suspense } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, LogOut, User } from "lucide-react";

function MagiManagerLogo({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="16" fill="url(#logoGradientLogout)" />
      <path
        d="M25 70V30H35L50 55L65 30H75V70H65V45L50 70L35 45V70H25Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="logoGradientLogout"
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

type LogoutState = "signing-out" | "signed-out";

function LogoutContent() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [logoutState, setLogoutState] = useState<LogoutState>("signing-out");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Get origin parameter (where the user logged out from)
  const origin = searchParams.get("origin");
  // Build the sign-in URL, preserving origin if present
  const signInUrl = origin ? `/?origin=${encodeURIComponent(origin)}` : "/";

  useEffect(() => {
    // Capture the email before signing out
    if (session?.user?.email) {
      setUserEmail(session.user.email);
    }

    // Only sign out if we have an active session
    if (status === "authenticated") {
      signOut({ redirect: false }).then(() => {
        setLogoutState("signed-out");
      });
    } else if (status === "unauthenticated") {
      // Already signed out
      setLogoutState("signed-out");
    }
  }, [status, session]);

  // Show loading while signing out
  if (status === "loading" || logoutState === "signing-out") {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <MagiManagerLogo size={64} />
          </div>
          <Loader2 className="h-6 w-6 text-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 font-medium">Signing you out...</p>
        </div>
      </main>
    );
  }

  // Signed out confirmation
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <MagiManagerLogo size={72} />
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl shadow-slate-950/50 animate-slide-up">
          {/* User avatar placeholder */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
              <User className="w-10 h-10 text-slate-500" />
            </div>
          </div>

          {/* Message */}
          <div className="flex items-center justify-center gap-2 text-emerald-400 mb-3">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Signed out</span>
          </div>

          <h1 className="text-xl font-semibold text-slate-100 mb-2">
            You've been signed out
          </h1>

          {userEmail && (
            <p className="text-sm text-slate-400 mb-6">
              {userEmail}
            </p>
          )}

          <p className="text-slate-400 text-sm mb-8">
            Thanks for using MagiManager. You've been signed out of all apps.
          </p>

          {/* Sign in again button */}
          <Link
            href={signInUrl}
            className="inline-flex items-center justify-center w-full px-4 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Sign in again
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8">
          <p className="text-xs text-slate-500">
            MagiManager - Accounts & Ads Management Platform
          </p>
        </div>
      </div>
    </main>
  );
}

// Wrap with Suspense for useSearchParams
export default function LogoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
          <div className="text-center animate-fade-in">
            <div className="flex justify-center mb-6">
              <MagiManagerLogo size={64} />
            </div>
            <Loader2 className="h-6 w-6 text-violet-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-300 font-medium">Loading...</p>
          </div>
        </main>
      }
    >
      <LogoutContent />
    </Suspense>
  );
}
