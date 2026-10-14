import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Three.js and R3F are ESM packages that Next bundles for the client only.
  // The 3D scene is loaded with `ssr: false`, so the server never touches WebGL.
  transpilePackages: ["three"],
};

export default nextConfig;
