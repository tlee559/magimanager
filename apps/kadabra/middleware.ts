import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || "https://login.magimanager.com";

// Cookie name must match auth-options.ts configuration
const SESSION_COOKIE_NAME = "__Secure-next-auth.session-token";

export async function middleware(request: NextRequest) {
  // Explicitly specify cookie name for SSO to work across subdomains
  const token = await getToken({
    req: request,
    cookieName: SESSION_COOKIE_NAME,
  });
  const isHomePage = request.nextUrl.pathname === "/";

  if (!token && !isHomePage) {
    // Not logged in and trying to access protected route
    // Redirect to central login portal with returnTo
    const returnTo = encodeURIComponent(request.url);
    return NextResponse.redirect(new URL(`${LOGIN_URL}?returnTo=${returnTo}`));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
