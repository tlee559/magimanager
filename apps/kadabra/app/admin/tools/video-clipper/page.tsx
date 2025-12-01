"use client";

import { useRouter } from "next/navigation";
import { VideoClipperView } from "@/lib/video-clipper-view";

export default function VideoClipperPage() {
  const router = useRouter();

  return <VideoClipperView onBack={() => router.push("/admin/tools")} />;
}
