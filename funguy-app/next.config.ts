import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // public/globe/ and public/eye/ are static-passthrough asset directories,
  // not Next.js routes — Next.js doesn't auto-resolve a directory request
  // to its index.html the way plain static hosting does, so /globe, /eye,
  // and their trailing-slash forms would 404 without these rewrites.
  async rewrites() {
    return [
      { source: "/globe", destination: "/globe/index.html" },
      { source: "/globe/", destination: "/globe/index.html" },
      { source: "/eye", destination: "/eye/index.html" },
      { source: "/eye/", destination: "/eye/index.html" },
    ];
  },
};

export default nextConfig;
