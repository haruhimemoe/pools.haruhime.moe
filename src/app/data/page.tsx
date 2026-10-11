/**
 * @file src/app/data/page.tsx
 * @desc /data: where pools' data comes from and how it's kept, in four sections the footer
 *       links by anchor: #pools (otdb's export, tournament hosts, community members; merged by
 *       map list, each pool page names its sources; built pools and their packs on packs), #maps (JSON from the hinai mirror, which
 *       serves osu! API data; a map it doesn't have keeps its source's; no files, star ratings with mods from the mirror), #rules (the check, guidance only; the all-maps search
 *       can't see takedown notices on ranked and loved maps) and #corrections
 *       (Discord or email). Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sun Oct 11, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PACKS_SITE_URL, SOURCE_CREDITS } from "@/constants/pools";
import { PAGE_SEO, SEO_SITE } from "@/constants/seo";
import { SITE } from "@/constants/site";

/** /data's title, description, canonical URL and link preview. */
export const metadata: Metadata = pageMetadata(SEO_SITE, { path: "/data", ...PAGE_SEO["/data"] });

const otdb = SOURCE_CREDITS.otdb;

/**
 * @function DataPage
 * @returns {JSX.Element} where pools, maps and values come from, and the check's rules
 */
export default function DataPage() {
  const t = useTranslations("pools.pages.data");
  return (
    <article>
      <PageHeader title={t("data")} lead={t("whereThePoolsAnd")} />
      <Prose className="mt-6 [&>:first-child>:first-child]:mt-0">
        <section id="pools" aria-labelledby="pools-title">
          {/* "Pool data", as the footer link says: a region named "Pools" would double the footer's
            pools column (axe landmark-unique). */}
          <h2 id="pools-title">{t("poolData")}</h2>
          <p>{t("poolsOnThisSite")}</p>
          <ul>
            <li>
              Some past pools come from the public export of <a href={otdb.url}>otdb</a>, by{" "}
              {otdb.author}, used with his permission.
            </li>
            <li>{t("tournamentHostsSendTheir")}</li>
            <li>{t("communityMembersSendPools")}</li>
          </ul>
          <p>{t("morePartnersMayJoin")}</p>
          <p>
            We read a pool's tournament, round and year from its name, so some are wrong. Admins fix
            what they find. Have a pool we're missing? <Link href="/submit">Submit a pool</Link>.
          </p>
          <p>{t("poolsBuiltHereAre")}</p>
        </section>
        <section id="maps" aria-labelledby="maps-title">
          <h2 id="maps-title">{t("mapData")}</h2>
          <p>
            Map details (artist, title, difficulty, length, BPM, AR, OD, CS and star rating) come
            from the <a href="https://mirror.hinamizawa.ai">hinai mirror</a>, which serves osu! API
            data. A map the mirror doesn't have keeps what its source gave. pools reads only JSON.
            It never hosts or passes on <code>.osz</code> files, audio or images: Open in packs
            takes you to <a href={PACKS_SITE_URL}>packs.haruhime.moe</a>, which downloads each map
            from the mirror straight to your browser.
          </p>
          <p>{t("aPoolSSlots")}</p>
          <p>{t("whereAMapWas")}</p>
          <p>{t("mapCoversAndPreview")}</p>
        </section>
        <section id="rules" aria-labelledby="rules-title">
          <h2 id="rules-title">{t("contentRules")}</h2>
          <p>
            The check follows the content rules for officially supported tournaments, from the osu!
            wiki's <a href={RULE_LINKS.contentUsage}>content usage permissions</a> and{" "}
            <a href={RULE_LINKS.officialSupport}>official support</a> pages. It uses{" "}
            <a href="https://github.com/haruhimemoe/compliance">@haruhimemoe/compliance</a>, which
            follows the <a href={UPSTREAM.repo}>osu! Mappool Compliance project</a>, and reads each
            beatmapset from the osu! API.
          </p>
          <p>
            Searching every map uses the same rules on what the hinai mirror sends. For ranked and
            loved maps, that search can't see takedown notices, so it may show one that has been
            taken down. <Link href="/check">Check a pool</Link> runs the full check.
          </p>
          <p>{t("theCheckCanBe")}</p>
        </section>
        <section id="corrections" aria-labelledby="corrections-title">
          <h2 id="corrections-title">{t("corrections")}</h2>
          <p>
            Found a wrong year, a missing map or a pool that shouldn't be here? Tell us in the{" "}
            <a href={SITE.discordUrl}>Discord server</a> or write to{" "}
            <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. Send the pool's link
            and what's wrong.
          </p>
        </section>
      </Prose>
    </article>
  );
}
