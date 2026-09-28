/**
 * @file src/components/layout/Footer.tsx
 * @desc Site footer: the pools / Data / About / Legal link columns, one line of fine print
 *       (where star ratings with mods come from, the affiliation notice; no source credit, since pools come from more than
 *       one place and each pool page and /credits name them), and the row linking the parent
 *       brand, the Discord server and the haruhimemoe GitHub org.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { SiteFooter } from "@haruhimemoe/ui";
import { FOOTER_COLUMNS, SITE } from "@/constants/site";

/**
 * @function Footer
 * @returns {JSX.Element} ui's SiteFooter with the columns, the Discord and GitHub links and the
 *          trademark notice
 */
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
