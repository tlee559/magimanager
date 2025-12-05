import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Validate returnTo URLs to prevent open redirect attacks
// Note: localhost is only allowed in development mode
export function isValidReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "magimanager.com" ||
      parsed.hostname.endsWith(".magimanager.com") ||
      (process.env.NODE_ENV !== "production" && parsed.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

// Get the appropriate redirect URL based on user role and origin
// If origin is provided and valid, respect it. Otherwise fall back to role-based defaults.
export function getDefaultRedirectUrl(role: string, origin?: string | null): string {
  const abraUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";
  const kadabraUrl = process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com";

  // If origin is provided, respect it (user should return to where they came from)
  if (origin) {
    try {
      const parsed = new URL(origin);
      const isKadabra = parsed.hostname === "magimanager.com" ||
                        parsed.hostname === "www.magimanager.com" ||
                        (process.env.NODE_ENV !== "production" && parsed.port === "3001");
      const isAbra = parsed.hostname === "abra.magimanager.com" ||
                     (process.env.NODE_ENV !== "production" && parsed.port === "3000");

      // MEDIA_BUYER can only access Kadabra, so override if they came from Abra
      if (role === "MEDIA_BUYER") {
        return `${kadabraUrl}/admin`;
      }

      // Respect the origin for non-MEDIA_BUYER roles
      if (isKadabra) {
        return `${kadabraUrl}/admin`;
      }
      if (isAbra) {
        return `${abraUrl}/admin`;
      }
    } catch {
      // Invalid origin URL, fall through to default
    }
  }

  // Default behavior based on role (no origin or invalid origin)
  // MEDIA_BUYER can only access Kadabra
  if (role === "MEDIA_BUYER") {
    return `${kadabraUrl}/admin`;
  }

  // All other roles (SUPER_ADMIN, ADMIN, MANAGER, ASSISTANT) go to Abra by default
  return `${abraUrl}/admin`;
}

// Extract the origin app from a returnTo URL or origin parameter
export function getOriginFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Return the origin (protocol + hostname + port)
    return parsed.origin;
  } catch {
    return null;
  }
}
