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
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-slate-100 mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}

// Pain Point Card Component
function PainPointCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
        <span className="text-red-400 font-bold">{number}</span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-1">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
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
          <a href="#pricing" className="text-slate-400 hover:text-slate-100 transition hidden sm:block">
            Pricing
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
      <section className="px-6 pt-16 pb-24 max-w-7xl mx-auto">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-6">
            Built for agencies that scale
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-slate-100 mb-6 leading-tight">
            Manage <span className="text-emerald-400">100+ Ad Accounts</span><br />
            Without Losing Your Mind
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 mb-8 max-w-3xl mx-auto">
            The command center for agencies running massive Google Ads operations.
            Stop drowning in spreadsheets. Start scaling profitably.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <a
              href={loginUrl}
              className="px-8 py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-lg shadow-lg shadow-emerald-500/25"
            >
              Start Managing Smarter
            </a>
            <a
              href="#demo"
              className="px-8 py-4 bg-slate-800 text-slate-100 font-semibold rounded-xl hover:bg-slate-700 transition text-lg border border-slate-700"
            >
              See How It Works
            </a>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-16 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value="500+" label="Accounts Managed" />
          <StatCard value="$2M+" label="Monthly Ad Spend" />
          <StatCard value="47%" label="Time Saved" />
          <StatCard value="99.9%" label="Uptime" />
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">
              Scaling an agency is <span className="text-red-400">brutal</span>
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              You started with 5 accounts. Now you have 50. Or 150. And everything is on fire.
            </p>
            <div className="space-y-6">
              <PainPointCard
                number="1"
                title="Spreadsheet Hell"
                description="You're tracking account access, logins, and spend across 47 different Google Sheets. One wrong edit and everything breaks."
              />
              <PainPointCard
                number="2"
                title="Team Chaos"
                description="Who has access to which account? Did Sarah revoke access when she left? Nobody knows. Nobody wants to check."
              />
              <PainPointCard
                number="3"
                title="Scaling Paralysis"
                description="You want to take on more clients but you can't. Your operations are held together with duct tape and prayers."
              />
              <PainPointCard
                number="4"
                title="Zero Visibility"
                description="Getting a birds-eye view of all accounts means opening 100 tabs. Your browser crashes. You cry."
              />
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-3xl p-8 md:p-12">
            <div className="text-6xl mb-6">🔥</div>
            <h3 className="text-2xl font-bold text-slate-100 mb-4">Sound familiar?</h3>
            <p className="text-slate-400 mb-6">
              Every agency hits this wall. The difference between those who break through
              and those who burn out? <span className="text-slate-100 font-medium">Systems.</span>
            </p>
            <p className="text-slate-400">
              MagiManager is the system you wish you built—but didn&apos;t have time to.
            </p>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="features" className="px-6 py-24 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">
              One dashboard to <span className="text-emerald-400">rule them all</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Everything you need to manage hundreds of accounts, team members, and client relationships—without the chaos.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon="🏢"
              title="Centralized Account Hub"
              description="All your Google Ads accounts in one place. See status, spend, and performance at a glance. No more tab chaos."
            />
            <FeatureCard
              icon="👥"
              title="Team & Access Control"
              description="Assign accounts to team members. Revoke access instantly. Know exactly who has access to what, always."
            />
            <FeatureCard
              icon="🔐"
              title="Secure Identity Management"
              description="Manage Business Manager profiles, email accounts, and payment methods. All encrypted. All organized."
            />
            <FeatureCard
              icon="📊"
              title="Cross-Account Analytics"
              description="Aggregate performance across all accounts. Spot trends, identify issues, and optimize at scale."
            />
            <FeatureCard
              icon="🚀"
              title="Bulk Operations"
              description="Make changes across multiple accounts simultaneously. What used to take hours now takes minutes."
            />
            <FeatureCard
              icon="🔔"
              title="Smart Alerts"
              description="Get notified when accounts need attention. Budget alerts, performance drops, access issues—never miss a beat."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="demo" className="px-6 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">
            Get started in <span className="text-emerald-400">minutes</span>
          </h2>
          <p className="text-slate-400 text-lg">No complex setup. No learning curve. Just results.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-bold text-emerald-400">1</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Connect Your Accounts</h3>
            <p className="text-slate-400">Link your Google Ads MCC and import all accounts in one click. We handle the rest.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-bold text-emerald-400">2</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Organize Your Team</h3>
            <p className="text-slate-400">Add team members, set roles, and assign accounts. Everyone sees exactly what they need.</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl font-bold text-emerald-400">3</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Scale With Confidence</h3>
            <p className="text-slate-400">Take on more clients knowing your operations can handle it. Grow without the growing pains.</p>
          </div>
        </div>
      </section>

      {/* Testimonial/Social Proof Section */}
      <section className="px-6 py-24 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-6">&quot;</div>
          <p className="text-2xl md:text-3xl text-slate-200 font-medium mb-8 leading-relaxed">
            We went from managing 30 accounts with 4 people to managing 150 accounts with the same team.
            MagiManager didn&apos;t just save us time—it saved our sanity.
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 font-bold">
              JK
            </div>
            <div className="text-left">
              <div className="text-slate-100 font-semibold">Jason Kim</div>
              <div className="text-slate-400 text-sm">Founder, Scale Digital Agency</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-6 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-400 text-lg">Start free. Upgrade when you&apos;re ready to scale.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Starter */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Starter</h3>
            <p className="text-slate-400 text-sm mb-6">For small teams getting organized</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-slate-100">$49</span>
              <span className="text-slate-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to 25 accounts
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                3 team members
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Basic analytics
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Email support
              </li>
            </ul>
            <a href={loginUrl} className="block w-full py-3 text-center bg-slate-800 text-slate-100 rounded-xl hover:bg-slate-700 transition font-semibold">
              Start Free Trial
            </a>
          </div>

          {/* Growth - Featured */}
          <div className="bg-gradient-to-b from-emerald-500/10 to-slate-900/50 border-2 border-emerald-500/50 rounded-2xl p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-slate-950 text-sm font-bold rounded-full">
              Most Popular
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Growth</h3>
            <p className="text-slate-400 text-sm mb-6">For agencies ready to scale</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-slate-100">$149</span>
              <span className="text-slate-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Up to 100 accounts
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                10 team members
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Advanced analytics
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Bulk operations
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Priority support
              </li>
            </ul>
            <a href={loginUrl} className="block w-full py-3 text-center bg-emerald-500 text-slate-950 rounded-xl hover:bg-emerald-400 transition font-bold">
              Start Free Trial
            </a>
          </div>

          {/* Enterprise */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Enterprise</h3>
            <p className="text-slate-400 text-sm mb-6">For large agencies & networks</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-slate-100">Custom</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm">
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited accounts
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Unlimited team members
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Custom integrations
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Dedicated success manager
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                SLA guarantee
              </li>
            </ul>
            <a href="mailto:hello@magimanager.com" className="block w-full py-3 text-center bg-slate-800 text-slate-100 rounded-xl hover:bg-slate-700 transition font-semibold">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-24 bg-gradient-to-b from-slate-950 to-emerald-950/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-slate-100 mb-6">
            Ready to scale your agency?
          </h2>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Join hundreds of agencies who stopped fighting their tools and started focusing on what matters: growing their business.
          </p>
          <a
            href={loginUrl}
            className="inline-block px-10 py-4 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition text-lg shadow-lg shadow-emerald-500/25"
          >
            Start Your Free Trial
          </a>
          <p className="text-slate-500 text-sm mt-4">No credit card required. 14-day free trial.</p>
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
              <a href="#pricing" className="hover:text-slate-100 transition">Pricing</a>
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
