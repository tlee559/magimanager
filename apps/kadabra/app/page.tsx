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

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 hover:border-emerald-500/50 transition-all duration-300 group">
      <div className="text-5xl mb-6 group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-xl font-bold text-slate-100 mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

// Stat Card Component
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-emerald-400 mb-2">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
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
        <div className="flex items-center gap-4">
          <a href="#features" className="text-slate-400 hover:text-slate-100 transition hidden sm:block">
            Features
          </a>
          <a href="#how-it-works" className="text-slate-400 hover:text-slate-100 transition hidden sm:block">
            How It Works
          </a>
          <a
            href={loginUrl}
            className="px-4 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition"
          >
            Sign In
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-32 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-8">
            AI-Powered Ad Management
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-100 mb-8 leading-tight">
            Scale & Optimize<br />
            <span className="text-emerald-400">100s of Ad Accounts</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            The AI-powered command center that helps agencies manage, scale, and optimize
            their advertising operations. Level up your agency.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href={loginUrl}
              className="px-10 py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-lg shadow-lg shadow-emerald-500/25"
            >
              Get Started
            </a>
            <a
              href="#features"
              className="px-10 py-4 bg-slate-800 text-slate-100 font-semibold rounded-xl hover:bg-slate-700 transition text-lg border border-slate-700"
            >
              Learn More
            </a>
          </div>

          {/* Invite Only Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-full text-slate-400 text-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>Currently invite-only</span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-20 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value="100s" label="Accounts Managed" />
          <StatCard value="AI" label="Powered Optimization" />
          <StatCard value="10x" label="Faster Operations" />
          <StatCard value="24/7" label="Intelligent Monitoring" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-28 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-100 mb-6">
            AI Tools That <span className="text-emerald-400">Actually Work</span>
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            Stop wasting time on repetitive tasks. Let AI handle the heavy lifting while you focus on strategy and growth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon="🤖"
            title="AI-Powered Insights"
            description="Machine learning algorithms analyze your accounts 24/7, surfacing opportunities and flagging issues before they become problems."
          />
          <FeatureCard
            icon="⚡"
            title="Lightning Fast Operations"
            description="What used to take hours now takes seconds. Bulk operations, automated workflows, and instant reporting at your fingertips."
          />
          <FeatureCard
            icon="📈"
            title="Smart Optimization"
            description="AI-driven recommendations to improve performance across all your accounts. Scale what works, pause what doesn't."
          />
          <FeatureCard
            icon="🎯"
            title="Precision Targeting"
            description="Advanced algorithms help you identify winning strategies and replicate success across your entire portfolio."
          />
          <FeatureCard
            icon="🔮"
            title="Predictive Analytics"
            description="See around corners with AI forecasting. Know what's coming before it happens and stay ahead of the curve."
          />
          <FeatureCard
            icon="🛡️"
            title="Intelligent Safeguards"
            description="Automated monitoring and alerts protect your accounts. Sleep well knowing AI is watching your back."
          />
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="px-6 py-28 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-100 mb-6">
              Simple. Powerful. <span className="text-emerald-400">Scalable.</span>
            </h2>
            <p className="text-slate-400 text-xl">Built for agencies that refuse to stay small.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-8">
                <span className="text-3xl font-bold text-emerald-400">1</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-4">Connect</h3>
              <p className="text-slate-400 text-lg">Bring all your accounts into one unified command center. See everything, control everything.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-8">
                <span className="text-3xl font-bold text-emerald-400">2</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-4">Automate</h3>
              <p className="text-slate-400 text-lg">Let AI handle the repetitive work. Optimization, monitoring, and reporting on autopilot.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-8">
                <span className="text-3xl font-bold text-emerald-400">3</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-100 mb-4">Scale</h3>
              <p className="text-slate-400 text-lg">Take on more accounts without adding headcount. Grow your agency without the growing pains.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="px-6 py-28 border-t border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-6xl mb-8">&quot;</div>
          <p className="text-2xl md:text-3xl text-slate-200 font-medium mb-10 leading-relaxed">
            We 5x&apos;d our account capacity without hiring a single person.
            The AI handles what used to take our team entire days.
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 font-bold text-lg">
              JK
            </div>
            <div className="text-left">
              <div className="text-slate-100 font-semibold text-lg">Jason K.</div>
              <div className="text-slate-400">Agency Founder</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-32 bg-gradient-to-b from-slate-950 via-emerald-950/20 to-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-slate-100 mb-8">
            Ready to level up<br />your agency?
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Join the agencies using AI to scale smarter, move faster, and dominate their markets.
          </p>
          <a
            href={loginUrl}
            className="inline-block px-12 py-5 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-xl shadow-lg shadow-emerald-500/25"
          >
            Get Started
          </a>
          <p className="text-slate-500 text-sm mt-6">Invite-only access. Request your spot today.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <SquareMLogoIcon size={32} />
              <span className="text-lg font-bold text-slate-100">MagiManager</span>
            </div>
            <div className="flex gap-8 text-sm text-slate-400">
              <a href="#features" className="hover:text-slate-100 transition">Features</a>
              <a href="#how-it-works" className="hover:text-slate-100 transition">How It Works</a>
              <a href="mailto:hello@magimanager.com" className="hover:text-slate-100 transition">Contact</a>
            </div>
            <p className="text-sm text-slate-500">
              © 2024 MagiManager. All rights reserved.
            </p>
          </div>
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
