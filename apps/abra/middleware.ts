import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || "https://login.magimanager.com";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isHomePage = request.nextUrl.pathname === "/";

  if (!token && !isHomePage) {
    // Not logged in and trying to access protected route
    // Redirect to central login portal with returnTo
    const returnTo = encodeURIComponent(request.url);
    return NextResponse.redirect(new URL(`${LOGIN_URL}?returnTo=${returnTo}`));
  }

  // If logged in and on home page, redirect to admin
  if (token && isHomePage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
