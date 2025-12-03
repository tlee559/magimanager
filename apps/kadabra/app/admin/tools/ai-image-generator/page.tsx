"use client";

import { AIImageGenerator } from "@/lib/ai-image-generator";
import { useRouter } from "next/navigation";

export default function AIImageGeneratorPage() {
  const router = useRouter();

  return <AIImageGenerator onBack={() => router.push("/admin/tools")} />;
}
