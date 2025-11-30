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
    <main className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
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
      <section className="px-6 pt-24 pb-32 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-8">
            AI-Powered Platform
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-100 mb-8 leading-tight">
            Run 100s of Ad Accounts.<br />
            <span className="text-emerald-400">Zero Headaches.</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            AI agents that help you scale. Auto reports that save you hours.
            Finally, a tool built for agencies that want to grow.
          </p>
          <a
            href={loginUrl}
            className="inline-block px-10 py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-lg shadow-lg shadow-emerald-500/25"
          >
            Get Started
          </a>
          <p className="text-slate-500 text-sm mt-6">Invite-only access</p>
        </div>
      </section>

      {/* Problem Section */}
      <section className="px-6 py-24 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-6">
            Sound familiar?
          </h2>
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-left">
              <div className="text-3xl mb-4">😫</div>
              <p className="text-slate-300 text-lg leading-relaxed">
                &quot;I spend hours every week making reports. I barely have time to actually run the ads.&quot;
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-left">
              <div className="text-3xl mb-4">🤯</div>
              <p className="text-slate-300 text-lg leading-relaxed">
                &quot;I want to take on more clients, but I can&apos;t keep up with the ones I have.&quot;
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-left">
              <div className="text-3xl mb-4">😴</div>
              <p className="text-slate-300 text-lg leading-relaxed">
                &quot;I&apos;m tired of checking each account one by one. There has to be a better way.&quot;
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-left">
              <div className="text-3xl mb-4">💸</div>
              <p className="text-slate-300 text-lg leading-relaxed">
                &quot;I miss things because I&apos;m spread too thin. It&apos;s costing me money.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section 1: AI Agents */}
      <section className="px-6 py-28 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium mb-6">
              AI AGENTS
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-6">
              Your new team members never sleep
            </h2>
            <p className="text-slate-400 text-lg mb-8 leading-relaxed">
              Our AI agents work around the clock. They watch your campaigns, spot what&apos;s working, and tell you what to fix. It&apos;s like having a team of experts looking at every account, every day.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-slate-300 text-lg">Find winning campaigns faster</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-slate-300 text-lg">Get ideas for better creatives</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-slate-300 text-lg">Track KPIs without the busywork</span>
              </li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-12 text-center">
            <div className="text-8xl mb-6">🤖</div>
            <p className="text-2xl font-bold text-slate-100 mb-2">AI Agents</p>
            <p className="text-slate-400">Working for you 24/7</p>
          </div>
        </div>
      </section>

      {/* Solution Section 2: Account Management */}
      <section className="px-6 py-28 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-3xl p-12 text-center">
              <div className="text-8xl mb-6">📊</div>
              <p className="text-2xl font-bold text-slate-100 mb-2">Auto Reports</p>
              <p className="text-slate-400">Hours saved every week</p>
            </div>
            <div className="order-1 md:order-2">
              <div className="inline-block px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-medium mb-6">
                ACCOUNT MANAGEMENT
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-6">
                100 accounts? No problem.
              </h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                See all your accounts in one place. Get reports without lifting a finger. Know what&apos;s happening across every account, every day. Stop jumping between tabs and spreadsheets.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-slate-300 text-lg">One dashboard for everything</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-slate-300 text-lg">Reports that build themselves</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-slate-300 text-lg">Alerts when something needs attention</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Stats */}
      <section className="px-6 py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">100s</div>
              <div className="text-slate-400">Accounts managed</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">10x</div>
              <div className="text-slate-400">Faster reporting</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">24/7</div>
              <div className="text-slate-400">AI monitoring</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-32 bg-gradient-to-b from-slate-950 via-emerald-950/20 to-slate-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-6">
            Ready to grow without the chaos?
          </h2>
          <p className="text-xl text-slate-400 mb-10">
            Stop working harder. Start working smarter.
          </p>
          <a
            href={loginUrl}
            className="inline-block px-12 py-5 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-xl shadow-lg shadow-emerald-500/25"
          >
            Get Started
          </a>
          <p className="text-slate-500 text-sm mt-6">Invite-only. Request your spot today.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <SquareMLogoIcon size={28} />
            <span className="font-bold text-slate-100">MagiManager</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2024 MagiManager. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  const router = useRouter();
  const { status } = useSession();

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

  return <LandingPage />;
}
