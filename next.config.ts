import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No native modules needed - using Supabase (cloud) instead of SQLite
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
