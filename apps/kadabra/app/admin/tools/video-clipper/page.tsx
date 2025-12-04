"use client";

import { VideoClipperView } from "@/lib/video-clipper/video-clipper-view";
import { useRouter } from "next/navigation";

export default function VideoClipperPage() {
  const router = useRouter();

  return <VideoClipperView onBack={() => router.push("/admin/tools")} />;
}
