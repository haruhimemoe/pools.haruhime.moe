/**
 * @file src/app/legal/page.tsx
 * @desc /legal: every legal page with its description, from the registry. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Mon Oct 5, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { ContentIndex, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";
import { toNavItem } from "@/utils/content-nav";

/** The page's title, description, canonical URL and link preview. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/legal",
  title: "pools legal pages",
  description:
    "The pools.haruhime.moe terms, privacy policy, privacy rights, copyright notice and disclaimers.",
});

const ITEMS = CONTENT.entries.legal.map(toNavItem("legal"));

/**
 * @function LegalIndexPage
 * @returns {JSX.Element} the section's header and its pages
 */
export default function LegalIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Legal" lead="The terms, how we handle your data, and what pools is not." />
      <ContentIndex items={ITEMS} />
    </div>
  );
}
