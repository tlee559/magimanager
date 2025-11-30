"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || "https://login.magimanager.com";
const ABRA_URL = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      // Already logged in, go to admin
      router.push("/admin");
    } else if (status === "unauthenticated") {
      // Not logged in, redirect to central login
      const returnTo = encodeURIComponent(`${ABRA_URL}/admin`);
      window.location.href = `${LOGIN_URL}?returnTo=${returnTo}`;
    }
  }, [status, router]);

  // Show loading while checking session
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </main>
  );
}
