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

export default function PrivacyPage() {
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
            <h1 className="text-3xl font-bold text-slate-100">Privacy Policy</h1>
          </div>
          <p className="text-slate-400">Last updated: December 1, 2025</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-slate max-w-none">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                1. Information We Collect
              </h2>
              <p className="text-slate-300 leading-relaxed">
                We collect information you provide directly to us, including your name, email address,
                and account credentials. We also collect information about your use of our services,
                including login activity, feature usage, and account management activities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                2. How We Use Your Information
              </h2>
              <p className="text-slate-300 leading-relaxed mb-3">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and security alerts</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                3. Information Sharing
              </h2>
              <p className="text-slate-300 leading-relaxed">
                We do not sell, trade, or otherwise transfer your personal information to outside parties.
                We may share information with trusted third parties who assist us in operating our platform,
                conducting our business, or servicing you, so long as those parties agree to keep this
                information confidential.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                4. Data Security
              </h2>
              <p className="text-slate-300 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your
                personal information against unauthorized access, alteration, disclosure, or destruction.
                This includes encryption, secure servers, and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                5. Third-Party Services
              </h2>
              <p className="text-slate-300 leading-relaxed">
                Our platform may integrate with third-party advertising services such as Google Ads and
                Meta Ads. When you connect these services, we access your advertising data in accordance
                with their respective terms of service and privacy policies. We only access data necessary
                to provide our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                6. Cookies and Tracking
              </h2>
              <p className="text-slate-300 leading-relaxed">
                We use cookies and similar tracking technologies to maintain your session, remember your
                preferences, and analyze how our services are used. You can control cookies through your
                browser settings, though some features may not function properly without them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                7. Your Rights
              </h2>
              <p className="text-slate-300 leading-relaxed">
                You have the right to access, correct, or delete your personal information. You may also
                request a copy of your data or ask us to restrict processing. To exercise these rights,
                please contact us using the information below.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                8. Changes to This Policy
              </h2>
              <p className="text-slate-300 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes
                by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-100 mb-4">
                9. Contact Us
              </h2>
              <p className="text-slate-300 leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at{" "}
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
