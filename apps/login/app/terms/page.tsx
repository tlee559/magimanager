"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <div className="flex items-center gap-4 mb-6">
            <MagiManagerLogo size={48} />
            <h1 className="text-3xl font-bold text-slate-100">
              Terms and Conditions
            </h1>
          </div>
          <p className="text-slate-400">Last updated: December 1, 2025</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-slate max-w-none">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                1. Agreement to Terms
              </h2>
              <p className="text-slate-300 leading-relaxed">
                By accessing or using MagiManager, you agree to be bound by these Terms and Conditions.
                If you do not agree with any part of these terms, you may not access or use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                2. Description of Services
              </h2>
              <p className="text-slate-300 leading-relaxed">
                MagiManager provides an accounts and ads management platform designed to help users
                manage their advertising accounts, campaigns, and related activities. Our services
                include but are not limited to account management, campaign tracking, and analytics tools.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                3. User Accounts
              </h2>
              <p className="text-slate-300 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials
                and for all activities that occur under your account. You agree to notify us immediately
                of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                4. Acceptable Use
              </h2>
              <p className="text-slate-300 leading-relaxed">
                You agree to use MagiManager only for lawful purposes and in accordance with these Terms.
                You agree not to use our services in any way that violates any applicable laws or regulations,
                or to engage in any conduct that restricts or inhibits anyone&apos;s use of the services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                5. Intellectual Property
              </h2>
              <p className="text-slate-300 leading-relaxed">
                The MagiManager platform, including its original content, features, and functionality,
                is owned by MagiManager and is protected by international copyright, trademark, and
                other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                6. Limitation of Liability
              </h2>
              <p className="text-slate-300 leading-relaxed">
                MagiManager shall not be liable for any indirect, incidental, special, consequential,
                or punitive damages resulting from your use of or inability to use the service.
                This limitation applies regardless of the legal theory on which the claim is based.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                7. Changes to Terms
              </h2>
              <p className="text-slate-300 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of any
                material changes by updating the &quot;Last updated&quot; date at the top of this page.
                Your continued use of the service after such modifications constitutes acceptance of
                the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                8. Contact Us
              </h2>
              <p className="text-slate-300 leading-relaxed">
                If you have any questions about these Terms and Conditions, please contact us at{" "}
                <a
                  href="mailto:contact@magimanager.com"
                  className="text-violet-400 hover:text-violet-300 transition"
                >
                  contact@magimanager.com
                </a>
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            MagiManager - Accounts & Ads Management Platform
          </p>
        </div>
      </div>
    </main>
  );
}
