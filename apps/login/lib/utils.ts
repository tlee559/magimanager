import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Validate returnTo URLs to prevent open redirect attacks
export function isValidReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "magimanager.com" ||
      parsed.hostname.endsWith(".magimanager.com") ||
      parsed.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

// Get the appropriate redirect URL based on user role
export function getDefaultRedirectUrl(role: string): string {
  const abraUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";
  const kadabraUrl = process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com";

  // MEDIA_BUYER can only access Kadabra
  if (role === "MEDIA_BUYER") {
    return `${kadabraUrl}/admin`;
  }

  // All other roles (SUPER_ADMIN, ADMIN, MANAGER, ASSISTANT) go to Abra by default
  return `${abraUrl}/admin`;
}
