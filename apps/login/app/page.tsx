"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, isValidReturnUrl, getDefaultRedirectUrl, getOriginFromUrl } from "@/lib/utils";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function MagiManagerLogo({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="16" fill="url(#logoGradient)" />
      <path
        d="M25 70V30H35L50 55L65 30H75V70H65V45L50 70L35 45V70H25Z"
        fill="white"
      />
      <defs>
        <linearGradient
          id="logoGradient"
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

type LoginState = "idle" | "loading" | "success" | "error";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loginState, setLoginState] = useState<LoginState>("idle");

  const returnTo = searchParams.get("returnTo");
  const origin = searchParams.get("origin"); // Origin app the user came from (e.g., for logout->login flow)

  // If already authenticated, redirect appropriately
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const userRole = (session.user as { role?: string }).role || "MEDIA_BUYER";

      if (returnTo && isValidReturnUrl(returnTo)) {
        window.location.href = returnTo;
      } else {
        // Use origin param if available, or extract origin from returnTo
        const effectiveOrigin = origin || getOriginFromUrl(returnTo);
        window.location.href = getDefaultRedirectUrl(userRole, effectiveOrigin);
      }
    }
  }, [status, session, returnTo, origin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoginState("loading");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoginState("error");
        // Reset to idle after shake animation
        setTimeout(() => setLoginState("idle"), 500);
        return;
      }

      // Success - show transition state
      setLoginState("success");

      // Redirect after brief delay for UX
      setTimeout(() => {
        if (returnTo && isValidReturnUrl(returnTo)) {
          window.location.href = returnTo;
        } else {
          // Refresh to get session and trigger the useEffect redirect
          router.refresh();
        }
      }, 800);
    } catch {
      setError("An error occurred. Please try again.");
      setLoginState("error");
      setTimeout(() => setLoginState("idle"), 500);
    }
  }

  // Show loading while checking session
  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
      </main>
    );
  }

  // Don't render login form if already authenticated (redirect will happen)
  if (status === "authenticated") {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <Loader2 className="h-8 w-8 text-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Redirecting...</p>
        </div>
      </main>
    );
  }

  // Success state - "Signing you in..."
  if (loginState === "success") {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <MagiManagerLogo size={64} />
          </div>
          <Loader2 className="h-6 w-6 text-violet-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 font-medium">Signing you in...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex justify-center mb-6">
            <MagiManagerLogo size={72} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 mb-2">
            Sign in
          </h1>
          <p className="text-slate-400 text-sm">
            to continue to MagiManager
          </p>
        </div>

        {/* Login card */}
        <div
          className={cn(
            "login-card bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl shadow-slate-950/50",
            "animate-slide-up",
            loginState === "error" && "error"
          )}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cn(
                  "w-full px-4 py-3 bg-slate-800/50 border rounded-lg text-slate-100",
                  "placeholder-slate-500 focus:outline-none transition-all duration-200",
                  error
                    ? "border-red-500/50 focus:border-red-500"
                    : "border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                )}
                disabled={loginState === "loading"}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={cn(
                    "w-full px-4 py-3 pr-12 bg-slate-800/50 border rounded-lg text-slate-100",
                    "placeholder-slate-500 focus:outline-none transition-all duration-200",
                    error
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-slate-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
                  )}
                  disabled={loginState === "loading"}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loginState === "loading"}
              className={cn(
                "w-full px-4 py-3 font-semibold rounded-lg transition-all duration-200",
                "bg-violet-600 text-white hover:bg-violet-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              )}
            >
              {loginState === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-3">
          <div className="flex items-center justify-center gap-4 text-xs">
            <a
              href="/terms"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              Terms & Conditions
            </a>
            <span className="text-slate-600">|</span>
            <a
              href="/privacy"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              Privacy Policy
            </a>
            <span className="text-slate-600">|</span>
            <a
              href="mailto:contact@magimanager.com"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              contact@magimanager.com
            </a>
          </div>
          <p className="text-xs text-slate-500">
            MagiManager - Accounts & Ads Management Platform
          </p>
        </div>
      </div>
    </main>
  );
}

// Wrap with Suspense for useSearchParams
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
