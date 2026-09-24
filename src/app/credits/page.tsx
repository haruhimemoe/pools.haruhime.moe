/**
 * @file src/app/credits/page.tsx
 * @desc /credits: where pools' data and rules come from (otdb by Sheppsu, the hinai mirror, the
 *       osu! API, the osu! Mappool Compliance project and the osu! wiki pages behind it), the
 *       packages it's built with, and the affiliation notice. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { Metadata } from "next";
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
          Every pool comes from <a href="https://otdb.sheppsu.me">otdb</a>, by Sheppsu, through its
          public export, used with his permission. Each pool page links the pool on otdb.
        </p>
        <h2>Map details</h2>
        <p>
          Map details and star ratings come from the{" "}
          <a href="https://mirror.hinamizawa.ai">hinai mirror</a>. Every star rating is without
          mods.
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
