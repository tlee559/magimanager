"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || "https://login.magimanager.com";
const KADABRA_URL = process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com";

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

function getLoginUrl() {
  const returnTo = encodeURIComponent(`${KADABRA_URL}/admin`);
  return `${LOGIN_URL}?returnTo=${returnTo}`;
}

// Landing page for new visitors
function LandingPage() {
  const loginUrl = getLoginUrl();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <SquareMLogoIcon size={40} />
          <span className="text-xl font-bold text-slate-100">MagiManager</span>
        </div>
        <a
          href={loginUrl}
          className="px-4 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition"
        >
          Sign In
        </a>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-24 pb-20 max-w-2xl mx-auto text-center">
        <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-8">
          AI-Powered Platform
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-slate-100 mb-6 leading-tight">
          Scale Your Agency.<br />
          <span className="text-emerald-400">Not Your Stress.</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 leading-relaxed">
          Built by marketers, for marketers. Manage and scale 100s of accounts while keeping everything optimized. AI-powered tools that make it easy to grow your agency the right way.
        </p>
        <a
          href={loginUrl}
          className="inline-block px-10 py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-lg shadow-lg shadow-emerald-500/25"
        >
          Get Started
        </a>
        <p className="text-slate-500 text-sm mt-4">Invite-only access</p>
      </section>

      {/* Sound Familiar Section */}
      <section className="px-6 py-16 max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-slate-100 mb-10">
          Sound familiar?
        </h2>
        <div className="space-y-4 text-left max-w-md mx-auto">
          <div className="flex items-start gap-4 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <span className="text-2xl">😩</span>
            <p className="text-slate-300 text-lg">Stuck finding winning ad copy and creatives?</p>
          </div>
          <div className="flex items-start gap-4 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <span className="text-2xl">😴</span>
            <p className="text-slate-300 text-lg">Tired of checking each account one by one?</p>
          </div>
          <div className="flex items-start gap-4 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <span className="text-2xl">🤯</span>
            <p className="text-slate-300 text-lg">Stuck in a loop cause you&apos;re just doing too much?</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 max-w-2xl mx-auto text-center flex-1">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-8">
          If this sounds like you...
        </h2>
        <a
          href={loginUrl}
          className="inline-block px-14 py-5 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-2xl shadow-lg shadow-emerald-500/25"
        >
          Login NOW!
        </a>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <SquareMLogoIcon size={24} />
            <span className="font-semibold text-slate-100">MagiManager</span>
          </div>
          <p className="text-sm text-slate-500">© 2024 MagiManager</p>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/admin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return <LandingPage />;
}
