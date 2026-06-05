import type { NextConfig } from "next";

// Bypass SSL inspection on campus/corporate networks (dev only)
// Remove this block before deploying to production
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const nextConfig: NextConfig = {
  // No native modules needed - using Supabase (cloud) instead of SQLite
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
