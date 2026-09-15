import type { NextConfig } from "next";

// The existing Sites build remains available. VPS releases are standalone
// static files: all current application state lives in the browser.
const nextConfig: NextConfig = {
  ...(process.env.YINCE_BUILD_TARGET === "vps" ? { output: "export" as const } : {}),
};

export default nextConfig;
