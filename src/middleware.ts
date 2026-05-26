import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes
  const publicPaths = ["/login", "/register", "/api/auth", "/api/admin/seed"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (isPublic) {
    if (token && (pathname === "/login" || pathname === "/register")) {
      // Redirect based on role
      const redirectUrl = token.role === "admin" ? "/admin" : "/chat";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.next();
  }

  // Protected routes
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin routes protection
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname.startsWith("/upload")) {
    if (token.role !== "admin") {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
