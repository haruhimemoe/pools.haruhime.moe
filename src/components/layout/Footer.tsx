/**
 * @file src/components/layout/Footer.tsx
 * @desc Site footer: the pools / Data / About / Legal link columns, one line of fine print
 *       (where star ratings with mods come from, the affiliation notice; no source credit, since pools come from more than
 *       one place and each pool page and /credits name them), and the row linking the parent
 *       brand, the Discord server and the haruhimemoe GitHub org.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
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
      { href: "/submit", label: "Submit a pool" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/data#pools", label: "Pool data" },
      { href: "/data#maps", label: "Map data" },
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
        <>
          Star ratings with mods come from the hinai mirror and can differ slightly from osu!'s.{" "}
          {SITE.trademarkNotice}
        </>
      }
      parentHref={SITE.parentUrl}
      githubHref={SITE.githubOrg}
      discordHref={SITE.discordUrl}
    />
  );
}
