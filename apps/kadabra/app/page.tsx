"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

function SquareMLogoIcon({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="100" height="100" rx="12" fill="url(#logoGradient)" />
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
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Login form component
function LoginForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setIsLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-6">
            <SquareMLogoIcon size={80} />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            MagiManager
          </h1>
          <p className="text-emerald-400 font-medium mb-1">Ads Console</p>
          <p className="text-slate-400 text-sm">
            Ads Management Hub
          </p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <button
          onClick={onBack}
          className="mt-6 w-full text-center text-sm text-slate-500 hover:text-slate-300 transition"
        >
          Back to home
        </button>
      </div>
    </main>
  );
}

// Landing page for new visitors
function LandingPage({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SquareMLogoIcon size={40} />
          <span className="text-xl font-bold text-slate-100">MagiManager</span>
        </div>
        <button
          onClick={onLoginClick}
          className="px-4 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition"
        >
          Sign In
        </button>
      </header>

      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <div className="flex justify-center mb-8">
            <SquareMLogoIcon size={120} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
            MagiManager
          </h1>
          <p className="text-emerald-400 font-medium text-xl mb-2">
            AI-Powered Google Ads Management
          </p>
          <p className="text-slate-400 text-lg mb-8">
            Optimize campaigns, analyze performance, and maximize ROI with intelligent automation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onLoginClick}
              className="px-8 py-3 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition text-lg"
            >
              Sign In to Get Started
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full px-6 py-6 text-center">
        <p className="text-xs text-slate-500">
          MagiManager - Google Ads Management Platform
        </p>
      </footer>
    </main>
  );
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const [showLogin, setShowLogin] = useState(false);

  // If already logged in, redirect to admin
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/admin");
    }
  }, [status, router]);

  // Show loading while checking session
  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  // If authenticated, don't render anything (redirect will happen)
  if (status === "authenticated") {
    return null;
  }

  // Show login form or landing page
  if (showLogin) {
    return <LoginForm onBack={() => setShowLogin(false)} />;
  }

  return <LandingPage onLoginClick={() => setShowLogin(true)} />;
}
