"use client";

import { VideoClipperView } from "@/lib/video-clipper-view";
import { useRouter } from "next/navigation";

export default function VideoClipperPage() {
  const router = useRouter();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Video Clipper</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create short clips from YouTube videos
        </p>
      </div>

      <VideoClipperView onBack={() => router.push("/admin/tools")} />
    </>
  );
}
