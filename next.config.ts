import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "chromadb", "pdf-parse"],
};

export default nextConfig;
