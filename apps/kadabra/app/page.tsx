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
            Create. Manage. Scale.<br />
            <span className="text-emerald-400">100s of Ad Accounts.</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Running ads for one client is easy. Running ads for 100 clients? That&apos;s where most agencies break. We built the tool that fixes that.
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

      {/* The Problem Section */}
      <section className="px-6 py-24 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-6 text-center">
            The more accounts you have,<br />the harder it gets
          </h2>
          <p className="text-slate-400 text-lg text-center mb-12 max-w-2xl mx-auto">
            You know the drill. Every new client means more work. More campaigns to build. More accounts to check. More things to optimize. It never ends.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <div className="text-3xl mb-4">😩</div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Creating is slow</h3>
              <p className="text-slate-400 leading-relaxed">
                Every new campaign takes forever. Copy this, paste that, change this setting, fix that targeting. Repeat 100 times.
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <div className="text-3xl mb-4">🤯</div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Managing is chaos</h3>
              <p className="text-slate-400 leading-relaxed">
                Which account needs attention? What&apos;s the status of that campaign? Where&apos;s that login? You&apos;re drowning in tabs and spreadsheets.
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <div className="text-3xl mb-4">😫</div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Scaling is painful</h3>
              <p className="text-slate-400 leading-relaxed">
                You want more clients. But more clients means more headaches. You&apos;re already maxed out. Something has to change.
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <div className="text-3xl mb-4">💸</div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Optimizing is impossible</h3>
              <p className="text-slate-400 leading-relaxed">
                You can&apos;t watch 100 accounts at once. Things slip. Performance drops. Money gets wasted. And you don&apos;t even know until it&apos;s too late.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Solution Section */}
      <section className="px-6 py-28 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-100 mb-6">
            What if it didn&apos;t have to be this way?
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            MagiManager gives you AI tools that handle the hard stuff. So you can run more accounts without working more hours.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* AI Agents */}
          <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-3xl p-10">
            <div className="text-6xl mb-6">🤖</div>
            <h3 className="text-2xl font-bold text-slate-100 mb-4">AI Agents That Work For You</h3>
            <p className="text-slate-400 text-lg mb-6 leading-relaxed">
              Our AI watches your campaigns around the clock. It spots problems before they cost you money. It finds what&apos;s working so you can do more of it.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-emerald-400">✓</span>
                <span>Finds winning campaigns and losing ones</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-emerald-400">✓</span>
                <span>Gives you ideas for better ads</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-emerald-400">✓</span>
                <span>Tracks your KPIs so you don&apos;t have to</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-emerald-400">✓</span>
                <span>Alerts you when something needs fixing</span>
              </li>
            </ul>
          </div>

          {/* Account Management */}
          <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-3xl p-10">
            <div className="text-6xl mb-6">📊</div>
            <h3 className="text-2xl font-bold text-slate-100 mb-4">One Place For Everything</h3>
            <p className="text-slate-400 text-lg mb-6 leading-relaxed">
              No more jumping between accounts. No more spreadsheets. See all your accounts, all your campaigns, all your data in one simple dashboard.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-purple-400">✓</span>
                <span>All accounts in one dashboard</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-purple-400">✓</span>
                <span>Reports that build themselves</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-purple-400">✓</span>
                <span>See what needs attention right now</span>
              </li>
              <li className="flex items-center gap-3 text-slate-300">
                <span className="text-purple-400">✓</span>
                <span>Scale without adding more work</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* The Result */}
      <section className="px-6 py-20 bg-slate-900/30 border-y border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-12">
            The result?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">100s</div>
              <div className="text-slate-400">of accounts under control</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">10x</div>
              <div className="text-slate-400">less time on busywork</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">24/7</div>
              <div className="text-slate-400">AI watching your back</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">0</div>
              <div className="text-slate-400">headaches</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-32 bg-gradient-to-b from-slate-950 via-emerald-950/20 to-slate-950">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-100 mb-6">
            Ready to run 100s of accounts<br />without losing your mind?
          </h2>
          <p className="text-xl text-slate-400 mb-10">
            Stop drowning in work. Start scaling smart.
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
