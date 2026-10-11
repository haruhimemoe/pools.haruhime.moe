/**
 * @file src/app/submit/page.tsx
 * @desc /submit: how tournament hosts and community members send a pool. Text, not a form
 *       (pools takes no public writes): post in the Discord server or email, with the
 *       tournament, round, year, a forum or sheet link, the maps (a packs link is easiest) and
 *       who to credit. An admin checks every pool by hand before it appears. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sun Oct 11, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { PageHeader, Prose } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PACKS_SITE_URL } from "@/constants/pools";
import { PAGE_SEO, SEO_SITE } from "@/constants/seo";
import { SITE } from "@/constants/site";

/** /submit's title, description, canonical URL and link preview. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/submit",
  ...PAGE_SEO["/submit"],
});

const discord = <a href={SITE.discordUrl}>Discord server</a>;
const email = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

/**
 * @function SubmitPage
 * @returns {JSX.Element} how to send a pool: the Discord server and what to include
 */
export default function SubmitPage() {
  const t = useTranslations("pools.pages.submit");
  return (
    <article>
      <PageHeader title={t("submitAPool")} lead={t("tournamentHostsAndCommunity")} />
      <Prose className="mt-6 [&>:first-child>:first-child]:mt-0">
        <section aria-labelledby="send-title">
          <h2 id="send-title">{t("whereToSendIt")}</h2>
          <p>
            Post in our {discord} or email {email}. One message per tournament is fine, with every
            round in it.
          </p>
        </section>
        <section aria-labelledby="include-title">
          <h2 id="include-title">{t("whatToInclude")}</h2>
          <ul>
            <li>{t("theTournamentSName")}</li>
            <li>{t("theRoundLikeQualifiers")}</li>
            <li>{t("theYearItWas")}</li>
            <li>{t("aLinkToThe")}</li>
            <li>
              The maps. A packs link is easiest: build the pool on{" "}
              <a href={PACKS_SITE_URL}>packs.haruhime.moe</a> and send its link. Beatmap IDs or
              links with their slots (NM1, HD2 and so on) work too.
            </li>
            <li>{t("whoToCreditOn")}</li>
          </ul>
        </section>
        <section aria-labelledby="next-title">
          <h2 id="next-title">{t("whatHappensNext")}</h2>
          <p>{t("anAdminChecksEvery")}</p>
          <p>
            Spotted a mistake in a pool that's already here? See{" "}
            <Link href="/data#corrections">corrections</Link>.
          </p>
        </section>
      </Prose>
    </article>
  );
}
