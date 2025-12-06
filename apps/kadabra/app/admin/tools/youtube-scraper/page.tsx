"use client";

import { YouTubeScraperView } from "@/lib/youtube-scraper";
import { useRouter } from "next/navigation";

export default function YouTubeScraperPage() {
  const router = useRouter();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">YouTube Scraper</h1>
        <p className="text-sm text-slate-500 mt-1">
          Download and save YouTube videos for ad research and creative inspiration
        </p>
      </div>

      <YouTubeScraperView onBack={() => router.push("/admin/tools")} />
    </>
  );
}
