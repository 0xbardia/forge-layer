import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Notes on the Vercel deploy:
//  - `output: "export"` is NOT set here. Vercel needs the standard
//    `.next/` build artifact (which contains `routes-manifest.json`)
//    so it can route requests through its own edge layer and apply
//    the `rewrites` from vercel.json. With `output: "export"` the
//    build goes to `out/` only, and Vercel cannot run the routes.
//  - The `trailingSlash: true` and `images.unoptimized` settings
//    are kept for parity with the rehearsal build that originally
//    targeted `out/`.
//  - `transpilePackages: ["genlayer-js"]` is required because
//    genlayer-js ships ESM that Next's bundler does not understand
//    otherwise.
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: dir,
  transpilePackages: ["genlayer-js"],
};

export default nextConfig;
