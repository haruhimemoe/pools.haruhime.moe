/**
 * @file next.config.ts
 * @desc Next.js config: MDX page extensions (the legal pages), strict mode, unoptimized images
 *       (every raster is an osu! CDN asset we never transform), security headers on every route
 *       (no framing, no MIME sniffing, a trimmed Referer; a full CSP needs nonces and comes
 *       later), and no X-Powered-By.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
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
};

export default withMDX(nextConfig);
