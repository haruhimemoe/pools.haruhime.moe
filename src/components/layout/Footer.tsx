/**
 * @file src/components/layout/Footer.tsx
 * @desc Site footer: the pools / About / Legal link columns, one line of fine print (the
 *       site-wide otdb credit, no-mod stars, the affiliation notice), and the row linking the
 *       parent brand and the haruhimemoe GitHub org.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { SiteFooter, type SiteFooterColumn } from "@haruhimemoe/ui";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";

export const FOOTER_COLUMNS: readonly SiteFooterColumn[] = [
  {
    title: "pools",
    items: [
      { href: "/search", label: "Search" },
      { href: "/check", label: "Check a pool" },
      { href: "/credits", label: "Credits" },
    ],
  },
  {
    title: "About",
    items: [
      { href: SITE.repoUrl, label: "Source on GitHub" },
      { href: `mailto:${SITE.contactEmail}`, label: SITE.contactEmail },
    ],
  },
  {
    title: "Legal",
    items: LEGAL_SLUGS.map((slug) => ({ href: `/legal/${slug}`, label: LEGAL_DOCS[slug].title })),
  },
];

export function Footer() {
  return (
    <SiteFooter
      columns={FOOTER_COLUMNS}
      finePrint={
        <>Pool data from otdb by Sheppsu. Star ratings are without mods. {SITE.trademarkNotice}</>
      }
      parentHref={SITE.parentUrl}
      githubHref={SITE.githubOrg}
    />
  );
}
