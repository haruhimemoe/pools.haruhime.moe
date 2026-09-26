/**
 * @file src/app/data/page.tsx
 * @desc /data: where pools' data comes from and how it's kept, in four sections the footer
 *       links by anchor: #pools (otdb's export, tournament hosts, community members; merged by
 *       map list, each pool page names its sources), #maps (JSON from the osu! API and the hinai
 *       mirror, no files, no-mod stars), #rules (the check, guidance only) and #corrections
 *       (Discord or email). Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { PACKS_SITE_URL, SOURCE_CREDITS } from "@/constants/pools";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "Data",
  description:
    "Where the pools and map details on pools.haruhime.moe come from, how the content rules check works, and how to send a correction.",
};

const otdb = SOURCE_CREDITS.otdb;

export default function DataPage() {
  return (
    <article>
      <PageHeader
        title="Data"
        lead="Where the pools and map details on this site come from, and how to fix them when they're wrong."
      />
      <Prose className="mt-6 [&>:first-child>:first-child]:mt-0">
        <section id="pools" aria-labelledby="pools-title">
          <h2 id="pools-title">Pools</h2>
          <p>Pools on this site come from a few places:</p>
          <ul>
            <li>
              Some past pools come from the public export of <a href={otdb.url}>otdb</a>, by{" "}
              {otdb.author}, used with his permission.
            </li>
            <li>Tournament hosts send their own pools.</li>
            <li>Community members send pools they played in or found.</li>
          </ul>
          <p>
            More partners may join later. When two sources have the same maps, pools keeps one pool
            with both of them. Each pool page names its sources.
          </p>
          <p>
            We read a pool's tournament, round and year from its name, so some are wrong. Admins fix
            what they find. Have a pool we're missing? <Link href="/submit">Submit a pool</Link>.
          </p>
        </section>
        <section id="maps" aria-labelledby="maps-title">
          <h2 id="maps-title">Maps</h2>
          <p>
            Map details (artist, title, difficulty, length, BPM, AR, OD, CS and star rating) come
            from the osu! API v2 and the <a href="https://mirror.hinamizawa.ai">hinai mirror</a>.
            pools reads only their JSON. It never hosts or passes on <code>.osz</code> files, audio
            or images: Open in packs takes you to <a href={PACKS_SITE_URL}>packs.haruhime.moe</a>,
            which downloads each map from the mirror straight to your browser.
          </p>
          <p>Every star rating is without mods, even in HR, DT or EZ slots.</p>
          <p>
            Where a map was played before comes from the pools on this site, so it only knows the
            pools we have.
          </p>
        </section>
        <section id="rules" aria-labelledby="rules-title">
          <h2 id="rules-title">Content rules</h2>
          <p>
            The check follows the content rules for officially supported tournaments, from the osu!
            wiki's <a href={RULE_LINKS.contentUsage}>content usage permissions</a> and{" "}
            <a href={RULE_LINKS.officialSupport}>official support</a> pages. It uses{" "}
            <a href="https://github.com/haruhimemoe/compliance">@haruhimemoe/compliance</a>, which
            follows the <a href={UPSTREAM.repo}>osu! Mappool Compliance project</a>, and reads each
            beatmapset from the osu! API.
          </p>
          <p>
            The check can be wrong. Its results are guidance, not rulings: the osu! Tournament
            Committee decides. A map it couldn't read is marked as such, never passed.
          </p>
        </section>
        <section id="corrections" aria-labelledby="corrections-title">
          <h2 id="corrections-title">Corrections</h2>
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
