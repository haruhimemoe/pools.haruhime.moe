/**
 * @file src/app/docs/page.tsx
 * @desc /docs: every docs page with its description, from the registry. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 11, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { ContentSearch, PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";
import { toNavItem } from "@/utils/content-nav";

/** The page's title, description, canonical URL and link preview. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/docs",
  title: "pools docs",
  description:
    "Developer docs for pools.haruhime.moe: the public API for scripts and bots, with hpl_ keys from your account page.",
});

const ITEMS = CONTENT.entries.docs.map(toNavItem("docs"));

/**
 * @function DocsIndexPage
 * @returns {JSX.Element} the section's header and its pages
 */
export default function DocsIndexPage() {
  const t = useTranslations("pools.pages.docs");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("docs")} lead={t("forDevelopersThePools")} />
      <ContentSearch items={ITEMS} label={t("searchTheDocs")} countNoun={["doc", "docs"]} />
    </div>
  );
}
