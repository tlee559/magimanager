import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isHomePage = request.nextUrl.pathname === "/";
  const isLogoutPage = request.nextUrl.pathname === "/logout";

  // Always allow logout page
  if (isLogoutPage) {
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
          parsed.hostname === "localhost";

        if (isValidDomain) {
          return NextResponse.redirect(new URL(returnTo));
        }
      } catch {
        // Invalid URL, fall through to default redirect
      }
    }

    // Default redirect based on role
    const userRole = (token as { role?: string }).role || "MEDIA_BUYER";
    const abraUrl = process.env.NEXT_PUBLIC_ABRA_URL || "https://abra.magimanager.com";
    const kadabraUrl = process.env.NEXT_PUBLIC_KADABRA_URL || "https://magimanager.com";

    if (userRole === "MEDIA_BUYER") {
      return NextResponse.redirect(new URL(`${kadabraUrl}/admin`));
    }

    return NextResponse.redirect(new URL(`${abraUrl}/admin`));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
