import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, AUTH_CONFIG } from "@magimanager/auth/cookie-config";

// Redirect loop protection
const REDIRECT_COUNT_COOKIE = "auth_redirect_count";
const MAX_REDIRECTS = 5;

export async function middleware(request: NextRequest) {
  // Check for redirect loop
  const redirectCount = parseInt(
    request.cookies.get(REDIRECT_COUNT_COOKIE)?.value || "0"
  );

  if (redirectCount >= MAX_REDIRECTS) {
    // Break the loop - redirect to error page
    const response = NextResponse.redirect(
      new URL("/auth-error", request.url)
    );
    response.cookies.delete(REDIRECT_COUNT_COOKIE);
    return response;
  }

  // Get token using shared cookie name and explicit secret
  const token = await getToken({
    req: request,
    cookieName: SESSION_COOKIE_NAME,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isHomePage = request.nextUrl.pathname === "/";
  const isLogoutPage = request.nextUrl.pathname === "/logout";
  const isAuthErrorPage = request.nextUrl.pathname === "/auth-error";

  // Always allow logout and error pages
  if (isLogoutPage || isAuthErrorPage) {
    return NextResponse.next();
  }

  // If logged in and on login page, redirect to appropriate app
  if (token && isHomePage) {
    const returnTo = request.nextUrl.searchParams.get("returnTo");

    // Validate returnTo URL
    if (returnTo) {
      try {
        const parsed = new URL(returnTo);
        const isValidDomain =
          parsed.hostname === "magimanager.com" ||
          parsed.hostname.endsWith(".magimanager.com") ||
          (process.env.NODE_ENV !== "production" && parsed.hostname === "localhost");

        if (isValidDomain) {
          // Clear redirect counter on successful auth
          const response = NextResponse.redirect(new URL(returnTo));
          response.cookies.delete(REDIRECT_COUNT_COOKIE);
          return response;
        }
      } catch {
        // Invalid URL, fall through to default redirect
      }
    }

    // Default redirect based on role and origin
    const userRole = (token as { role?: string }).role || "MEDIA_BUYER";
    const abraUrl = AUTH_CONFIG.urls.abra;
    const kadabraUrl = AUTH_CONFIG.urls.kadabra;

    // Check for origin parameter (passed during logout->login flow)
    const origin = request.nextUrl.searchParams.get("origin");

    let redirectUrl: string;
    if (origin) {
      // Try to respect origin, but MEDIA_BUYER can only access Kadabra
      try {
        const parsed = new URL(origin);
        const isKadabra = parsed.hostname === "magimanager.com" ||
                          parsed.hostname === "www.magimanager.com";

        if (userRole === "MEDIA_BUYER") {
          redirectUrl = `${kadabraUrl}/admin`;
        } else if (isKadabra) {
          redirectUrl = `${kadabraUrl}/admin`;
        } else {
          redirectUrl = `${abraUrl}/admin`;
        }
      } catch {
        // Invalid origin, use role-based default
        redirectUrl = userRole === "MEDIA_BUYER" ? `${kadabraUrl}/admin` : `${abraUrl}/admin`;
      }
    } else {
      // No origin, use role-based default
      redirectUrl = userRole === "MEDIA_BUYER" ? `${kadabraUrl}/admin` : `${abraUrl}/admin`;
    }

    const response = NextResponse.redirect(new URL(redirectUrl));

    // Clear redirect counter on successful auth
    response.cookies.delete(REDIRECT_COUNT_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
