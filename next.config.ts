/**
 * @file next.config.ts
 * @desc Next.js config: MDX page extensions (the legal pages), strict mode, unoptimized images
 *       (every raster is an osu! CDN asset we never transform), security headers on every route
 *       (no framing, no MIME sniffing, a trimmed Referer, images only from here, data: URIs and
 *       osu!'s hosts, media only from osu!'s; a full CSP needs nonces and comes later), no X-Powered-By, and built pools' pages: /pools/<b- id> is served by
 *       /pools/built/[id], which reads the session, while past pools stay cookie-free ISR. The
 *       internal path itself redirects (308) to /pools/<id>: redirects match the incoming path
 *       before rewrites run, so only a direct request for it is sent back.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Oct 3, 2026
 */

import createMDX from "@next/mdx";
import type { NextConfig } from "next";

// Turbopack only takes MDX plugins as module names, not imported functions. The legal pages
// have no pipe tables, so remark-gfm isn't pinned.
const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: { remarkPlugins: ["@haruhimemoe/ui/remark"] },
});

/**
 * frame-ancestors (with X-Frame-Options for older browsers) stops clickjacking. Images load from
 * here, data: URIs (inline images CSS and Next.js may use; nothing on the site needs one today,
 * and they can't run script) and osu!'s hosts only: avatars (a.ppy.sh, and osu.ppy.sh's guest
 * avatar; src/utils/avatar.ts shows no other) and map covers (assets.ppy.sh); media only from
 * osu!'s preview clips (b.ppy.sh). Nothing else is limited yet.
 */
const CSP = [
  "frame-ancestors 'none'",
  "img-src 'self' data: https://a.ppy.sh https://osu.ppy.sh https://assets.ppy.sh",
  "media-src https://b.ppy.sh",
].join("; ");

/** Sent on every route. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: CSP },
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
  // brand draws the pool cards per request: resvg is a native binary and brand reads its fonts
  // by a computed path, so both stay out of the bundle and the fonts are traced for the route
  // (the key is a picomatch glob: "[id]" would be a character class).
  serverExternalPackages: ["@haruhimemoe/brand", "@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/pools/*/og.png": ["./node_modules/@haruhimemoe/brand/fonts/*.ttf"],
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
