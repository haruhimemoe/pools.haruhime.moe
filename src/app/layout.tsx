/**
 * @file src/app/layout.tsx
 * @desc Root layout: Nunito font variable, site metadata, dark osu!-web body, and the library
 *       PageShell frame around the pools header and footer. A beta build (NEXT_PUBLIC_POOLS_BETA)
 *       gets the header's beta tag; the title template and robots stay the same.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { PageShell } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SITE } from "@/constants/site";
import { isBeta } from "@/lib/beta";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

/** The site's default title template, description, icons and link preview. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s · ${SITE.title}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

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
