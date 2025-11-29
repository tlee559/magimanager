import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ABRA_URL, KADABRA_URL } from "@/lib/constants";

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

function LandingPage() {
  const loginUrl = `${ABRA_URL}?returnTo=${encodeURIComponent(KADABRA_URL)}`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center">
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
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <div className="flex justify-center mb-8">
            <SquareMLogoIcon size={120} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
            MagiManager
          </h1>
          <p className="text-emerald-400 font-medium text-xl mb-2">
            Kadabra - Media Buyer Portal
          </p>
          <p className="text-slate-400 text-lg mb-8">
            AI-powered Google Ads management platform for media buyers.
            Optimize campaigns, analyze performance, and maximize ROI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={loginUrl}
              className="px-8 py-3 bg-emerald-500 text-slate-950 font-semibold rounded-lg hover:bg-emerald-400 transition text-lg"
            >
              Sign In to Get Started
            </a>
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

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    // User is logged in, go to their dashboard
    redirect("/admin");
  }

  // Not logged in, show landing page
  return <LandingPage />;
}
