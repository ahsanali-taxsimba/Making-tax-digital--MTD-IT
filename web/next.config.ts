import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://localhost:2327"],
  transpilePackages: ["pdfjs-dist"],
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/admin/overview", permanent: false },
      { source: "/practice", destination: "/practice/dashboard", permanent: false },
      { source: "/client", destination: "/client/home", permanent: false },
      { source: "/portal", destination: "/client/home", permanent: false },
      { source: "/portal/vat", destination: "/client/vat", permanent: false },
      { source: "/portal/itsa", destination: "/client/itsa", permanent: false },
      { source: "/portal/documents", destination: "/client/documents", permanent: false },
      { source: "/portal/messages", destination: "/client/messages", permanent: false },
    ];
  },
};

export default nextConfig;
