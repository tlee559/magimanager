"use client";

import { AdSpyView } from "@/lib/adspy";
import { useRouter } from "next/navigation";

export default function AdSpyPage() {
  const router = useRouter();

  return (
    <AdSpyView onBack={() => router.push("/admin/tools")} />
  );
}
