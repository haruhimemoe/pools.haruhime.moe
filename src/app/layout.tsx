/**
 * @file src/app/layout.tsx
 * @desc Root layout: Nunito font variable, site metadata (next-kit's siteMetadata: "osu!
 *       tournament mappool builder · pools.haruhime.moe" by default, "%s · pools.haruhime.moe"
 *       for pages, the static link preview; no canonical, which each page sets), dark osu!-web
 *       body, and the library PageShell frame around the pools header and footer. A beta build (NEXT_PUBLIC_POOLS_BETA)
 *       gets the header's beta tag; the title template and robots stay the same.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { siteMetadata } from "@haruhimemoe/next-kit/seo";
import { PageShell } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SEO_SITE } from "@/constants/seo";
import { isBeta } from "@/lib/beta";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

/** The site's default title and template, description, link preview and twitter card. */
export const metadata: Metadata = siteMetadata(SEO_SITE);

/**
 * @function RootLayout
 * @param props {{ children: ReactNode }} the page
 * @returns {JSX.Element} the html frame: header (with the beta tag when set), the page and the
 *          footer
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="bg-b5 font-sans text-c2 antialiased">
        <PageShell header={<Header beta={isBeta()} />} footer={<Footer />}>
          {children}
        </PageShell>
      </body>
    </html>
  );
}
