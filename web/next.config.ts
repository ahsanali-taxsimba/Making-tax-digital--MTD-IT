import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://localhost:2327"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
