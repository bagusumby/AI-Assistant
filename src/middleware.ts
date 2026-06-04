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
      let redirectUrl = "/chat";
      if (session.user?.role === "admin") redirectUrl = "/admin";
      else if (session.user?.roleType === "manager") redirectUrl = "/upload";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.next();
  }

  // Protected routes
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = session.user?.role;
  const roleType = session.user?.roleType;

  // Admin-only routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
  }

  // Upload routes: admin or managers only
  if (
    pathname.startsWith("/upload") ||
    pathname.startsWith("/api/upload") ||
    pathname.startsWith("/api/files")
  ) {
    if (role !== "admin" && roleType !== "manager") {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
