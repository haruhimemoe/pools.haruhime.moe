/**
 * @file src/app/pools/built/[id]/page.tsx
 * @desc A built pool's page. Visitors reach it at /pools/<b- id>: next.config.ts rewrites that
 *       here, because /pools/[id] is cookie-free ISR for past pools and this page reads the
 *       session (a private pool shows only to its owner and editors). Anyone who can't see the
 *       pool (private, hidden, or not there) gets the site 404. Private, unlisted and hidden
 *       pools aren't indexed; the canonical address is /pools/<id>.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { RULE_LINKS, UPSTREAM } from "@haruhimemoe/compliance";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BuiltPoolView } from "@/components/builder/BuiltPoolView";
import { BUILT_POOL_ID_PATTERN } from "@/constants/built-pools";
import { getCurrentUser } from "@/lib/auth-session";
import { loadBuiltPoolFor } from "@/services/built-pool-maps";
import { builtHeadline } from "@/utils/pool-text";

const load = cache(async (id: string) =>
  BUILT_POOL_ID_PATTERN.test(id) ? loadBuiltPoolFor(id, await getCurrentUser()) : null,
);

export async function generateMetadata({
  params,
}: PageProps<"/pools/built/[id]">): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded) return { robots: { index: false } };
  const { pool } = loaded;
  const listed = pool.visibility === "public" && !pool.hidden;
  const headline = builtHeadline(pool);
  return {
    title: pool.name,
    description: `${headline ? `${headline}. ` : ""}A pool of ${pool.slots.length} maps built on pools.`,
    alternates: { canonical: `/pools/${pool.id}` },
    ...(listed ? {} : { robots: { index: false } }),
  };
}

export default async function BuiltPoolPage({ params }: PageProps<"/pools/built/[id]">) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded) notFound();
  return (
    <BuiltPoolView
      pool={loaded.pool}
      maps={loaded.maps}
      rules={{
        contentUsage: RULE_LINKS.contentUsage,
        officialSupport: RULE_LINKS.officialSupport,
        project: UPSTREAM.repo,
      }}
    />
  );
}
