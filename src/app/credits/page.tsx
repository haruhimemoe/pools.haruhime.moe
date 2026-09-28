/**
 * @file src/app/credits/page.tsx
 * @desc /credits: where pools' data and rules come from (otdb by Sheppsu for some past pools,
 *       the tournament hosts and community members who send the others, credited on each pool
 *       page unless they asked not to be named; the hinai mirror, which serves osu! API data, for
 *       map details; the osu! Mappool Compliance project and the osu! wiki pages behind it), the
 *       packages it's built with, and the affiliation notice. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/constants/site";

export const metadata: Metadata = {
  title: "Credits",
  description: "Where pools' pool data, map details and content rules come from.",
};

const PACKAGES = ["pool", "osu", "hinai", "compliance", "ui", "brand"] as const;

export default function CreditsPage() {
  return (
    <article>
      <PageHeader
        title="Credits"
        lead="pools is built on other people's work. This is where everything comes from."
      />
      <Prose className="mt-6">
        <h2>Pool data</h2>
        <p>
          Some past pools come from <a href="https://otdb.sheppsu.me">otdb</a>, by Sheppsu, through
          its public export, used with his permission. Their pool pages link the pool on otdb.
        </p>
        <p>
          Tournament hosts and community members send the others. Thank you to everyone who does:
          each pool page credits who sent it, unless they asked not to be named. To send one, see{" "}
          <Link href="/submit">Submit a pool</Link>.
        </p>
        <h2>Map details</h2>
        <p>
          Map details and star ratings come from the{" "}
          <a href="https://mirror.hinamizawa.ai">hinai mirror</a>, which serves osu! API data. A map
          the mirror doesn't have keeps what its source gave. Star ratings with mods come from the
          mirror too, and can differ slightly from osu!'s.
        </p>
        <h2>Content rules</h2>
        <p>
          The check follows the osu! wiki's{" "}
          <a href={RULE_LINKS.contentUsage}>content usage permissions</a> and{" "}
          <a href={RULE_LINKS.officialSupport}>official support</a> pages, through the rules of the{" "}
          <a href={UPSTREAM.repo}>osu! Mappool Compliance project</a>, and reads each beatmapset
          from the osu! API. Its results are guidance, not rulings: the osu! Tournament Committee
          decides.
        </p>
        <h2>Built with</h2>
        <ul>
          {PACKAGES.map((name) => (
            <li key={name}>
              <a href={`https://github.com/haruhimemoe/${name}`}>@haruhimemoe/{name}</a>
            </li>
          ))}
        </ul>
        <p>{SITE.trademarkNotice}</p>
      </Prose>
    </article>
  );
}
