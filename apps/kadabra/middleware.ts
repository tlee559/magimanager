import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isHomePage = request.nextUrl.pathname === "/";

  if (!token && !isHomePage) {
    // Not logged in and trying to access protected route
    // Redirect to abra login with returnTo URL
    const abraUrl = process.env.NEXT_PUBLIC_ABRA_URL || "http://localhost:3000";
    const returnUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(`${abraUrl}?returnTo=${returnUrl}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
