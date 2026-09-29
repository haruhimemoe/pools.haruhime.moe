/**
 * @file src/app/pools/built/[id]/page.tsx
 * @desc A built pool's page. Visitors reach it at /pools/<b- id>: next.config.ts rewrites that
 *       here, because /pools/[id] is cookie-free ISR for past pools and this page reads the
 *       session (a private pool shows only to its owner and editors). Anyone who can't see the
 *       pool (private, hidden, or not there) gets the site 404. Private, unlisted and hidden
 *       pools aren't indexed and carry no JSON-LD; the canonical address is /pools/<id>, and a
 *       listed one gets breadcrumbs. Each slot shows its values
 *       under its mods (src/services/slot-values.ts, from the mod_values cache or the mirror).
 *       A pack still waiting to sync to packs syncs after the page is sent.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import { ld, notFoundMetadata, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { JsonLd } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BuiltPoolView } from "@/components/builder/BuiltPoolView";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { SEO_SITE } from "@/constants/seo";
import { getCurrentUser } from "@/lib/auth-session";
import { schedulePackSync } from "@/lib/pack-sync-after";
import { loadBuiltPoolFor } from "@/services/built-pool-maps";
import { builtSlotValues } from "@/services/slot-values";
import { packWaiting } from "@/utils/built-pack";
import { builtHeadline } from "@/utils/pool-text";

const isListed = (pool: { visibility: string; hidden: boolean }): boolean =>
  pool.visibility === "public" && !pool.hidden;

const load = cache(async (id: string) =>
  BUILT_POOL_ID_PATTERN.test(id) ? loadBuiltPoolFor(id, await getCurrentUser()) : null,
);

/**
 * @function generateMetadata
 * @param props {PageProps<"/pools/built/[id]">} the built pool's id
 * @returns {Promise<Metadata>} its title, description, canonical /pools/<id> and link preview,
 *          noindex unless public and not hidden; "Pool not found" (noindex) for anyone who can't
 *          see it
 */
export async function generateMetadata({
  params,
}: PageProps<"/pools/built/[id]">): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded) return notFoundMetadata(SEO_SITE, "Pool");
  const { pool } = loaded;
  const headline = builtHeadline(pool);
  return pageMetadata(SEO_SITE, {
    path: `/pools/${pool.id}`,
    title: pool.name,
    description: `${headline ? `${headline}. ` : ""}An osu! tournament mappool of ${pool.slots.length} ${pool.slots.length === 1 ? "map" : "maps"} built on pools, with star ratings under each slot's mods and the content rules check.`,
    index: isListed(pool),
  });
}

/**
 * @function BuiltPoolPage
 * @param props {PageProps<"/pools/built/[id]">} the built pool's id
 * @returns {Promise<JSX.Element>} the pool for whoever may see it, or a 404
 */
export default async function BuiltPoolPage({ params }: PageProps<"/pools/built/[id]">) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded) notFound();
  // A change that waited out the 30 s between syncs goes to packs now.
  if (packWaiting(loaded.pool.pack)) schedulePackSync(loaded.pool.id);
  const { values } = await builtSlotValues(loaded.pool, loaded.maps);
  const { pool } = loaded;
  return (
    <>
      {isListed(pool) ? (
        <JsonLd
          data={ld.graph(
            ld.breadcrumbs(SEO_SITE, [
              { name: SEO_SITE.name, path: "/" },
              { name: pool.name, path: `/pools/${pool.id}` },
            ]),
          )}
        />
      ) : null}
      <BuiltPoolView
        pool={loaded.pool}
        maps={loaded.maps}
        values={values}
        rules={{
          contentUsage: RULE_LINKS.contentUsage,
          officialSupport: RULE_LINKS.officialSupport,
          project: UPSTREAM.repo,
        }}
      />
    </>
  );
}
