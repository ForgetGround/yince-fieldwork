import type { NextConfig } from "next";

// Static assets on Nginx; authenticated business data comes from the API.
const nextConfig: NextConfig = process.env.YINCE_BUILD_TARGET === "vps"
  ? { output: "export" }
  : { distDir: ".next-dev", async rewrites() { return [{ source: "/api/:path*", destination: "http://127.0.0.1:59604/api/:path*" }]; } };
export default nextConfig;
