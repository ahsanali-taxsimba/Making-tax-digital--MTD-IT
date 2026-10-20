import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://localhost:2327"],
  transpilePackages: ["pdfjs-dist"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
