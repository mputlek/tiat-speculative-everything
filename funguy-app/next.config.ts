import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // public/globe/ is a static-passthrough asset directory, not a Next.js
  // route — Next.js doesn't auto-resolve a directory request to its
  // index.html the way plain static hosting does, so /globe and /globe/
  // would 404 without these rewrites.
  async rewrites() {
    return [
      { source: "/globe", destination: "/globe/index.html" },
      { source: "/globe/", destination: "/globe/index.html" },
    ];
  },
};

export default nextConfig;
