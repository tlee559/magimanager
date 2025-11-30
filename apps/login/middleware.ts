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

    // Default redirect based on role
    const userRole = (token as { role?: string }).role || "MEDIA_BUYER";
    const abraUrl = AUTH_CONFIG.urls.abra;
    const kadabraUrl = AUTH_CONFIG.urls.kadabra;

    const response =
      userRole === "MEDIA_BUYER"
        ? NextResponse.redirect(new URL(`${kadabraUrl}/admin`))
        : NextResponse.redirect(new URL(`${abraUrl}/admin`));

    // Clear redirect counter on successful auth
    response.cookies.delete(REDIRECT_COUNT_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
