import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes
  const publicPaths = ["/login", "/register", "/api/admin/seed"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (isPublic) {
    if (session && (pathname === "/login" || pathname === "/register")) {
      const redirectUrl = session.user?.role === "admin" ? "/admin" : "/chat";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.next();
  }

  // Protected routes
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin routes protection
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname.startsWith("/upload")) {
    if (session.user?.role !== "admin") {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
