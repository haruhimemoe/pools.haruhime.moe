/**
 * @file next.config.ts
 * @desc Next.js config: MDX page extensions (the legal pages), strict mode, unoptimized images
 *       (every raster is an osu! CDN asset we never transform), security headers on every route
 *       (no framing, no MIME sniffing, a trimmed Referer; a full CSP needs nonces and comes
 *       later), no X-Powered-By, and built pools' pages: /pools/<b- id> is served by
 *       /pools/built/[id], which reads the session, while past pools stay cookie-free ISR. The
 *       internal path itself redirects (308) to /pools/<id>: redirects match the incoming path
 *       before rewrites run, so only a direct request for it is sent back.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({ extension: /\.mdx?$/ });

/** Sent on every route. frame-ancestors (and X-Frame-Options for older browsers) stop clickjacking. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [{ source: "/pools/built/:id", destination: "/pools/:id", permanent: true }];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/pools/:id(b-[^/]+)", destination: "/pools/built/:id" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withMDX(nextConfig);
