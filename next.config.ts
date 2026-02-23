import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "reprally.nyc3.cdn.digitaloceanspaces.com",
      },
    ],
  },
  serverExternalPackages: ["chromadb"],
};

export default nextConfig;
