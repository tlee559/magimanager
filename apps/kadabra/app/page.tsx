import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    // User is logged in, go to their dashboard
    redirect("/admin");
  } else {
    // Not logged in, redirect to abra for authentication
    const abraLoginUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";
    const returnUrl = encodeURIComponent(process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com");
    redirect(`${abraLoginUrl}?returnTo=${returnUrl}`);
  }
}
