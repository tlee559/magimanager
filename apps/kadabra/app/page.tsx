import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    // User is logged in, go to their dashboard
    redirect("/admin");
  }

  // Not logged in - show landing page
  const abraLoginUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";
  const returnUrl = encodeURIComponent(process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <span className="text-xl font-semibold text-white">MagiManager</span>
        </div>
        <Link
          href={`${abraLoginUrl}?returnTo=${returnUrl}`}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition"
        >
          Sign In
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-4xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Manage Your Google Ads
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400"> Like Magic</span>
          </h1>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            The ultimate platform for media buyers to manage multiple Google Ads accounts efficiently.
            Track spend, monitor performance, and scale your campaigns.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`${abraLoginUrl}?returnTo=${returnUrl}`}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-semibold text-lg transition shadow-lg shadow-purple-500/25"
            >
              Get Started
            </Link>
            <a
              href="mailto:support@magimanager.com"
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-lg transition border border-slate-700"
            >
              Contact Us
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} MagiManager. All rights reserved.
      </footer>
    </div>
  );
}
