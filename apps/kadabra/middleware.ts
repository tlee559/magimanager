import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, AUTH_CONFIG } from "@magimanager/auth/cookie-config";

// Redirect loop protection
const REDIRECT_COUNT_COOKIE = "auth_redirect_count";
const MAX_REDIRECTS = 5;

export async function middleware(request: NextRequest) {
  // Redirect www to non-www to prevent cookie fragmentation
  const host = request.headers.get("host") || "";
  if (host.startsWith("www.")) {
    const newUrl = new URL(request.url);
    newUrl.host = host.replace("www.", "");
    return NextResponse.redirect(newUrl, { status: 301 });
  }

  const isHomePage = request.nextUrl.pathname === "/";
  const isAuthErrorPage = request.nextUrl.pathname === "/auth-error";
  const isLogoutPage = request.nextUrl.pathname === "/logout";
  const isPitchDeck = request.nextUrl.pathname.startsWith("/pitchdeck");

  // Always allow error, logout, and public pages
  if (isAuthErrorPage || isLogoutPage || isPitchDeck) {
    return NextResponse.next();
  }

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

  if (!token && !isHomePage) {
    // Not logged in and trying to access protected route
    // Redirect to central login portal with returnTo
    const returnTo = encodeURIComponent(request.url);
    const response = NextResponse.redirect(
      new URL(`${AUTH_CONFIG.urls.login}?returnTo=${returnTo}`)
    );
    // Increment redirect counter
    response.cookies.set(REDIRECT_COUNT_COOKIE, String(redirectCount + 1), {
      maxAge: 60, // Expires in 1 minute
      path: "/",
    });
    return response;
  }

  // Clear redirect counter on successful page load
  if (token) {
    const response = NextResponse.next();
    response.cookies.delete(REDIRECT_COUNT_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
