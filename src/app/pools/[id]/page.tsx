/**
 * @file src/app/pools/[id]/page.tsx
 * @desc /pools/[id]: a pool's public page. Cookie-free ISR, hourly, rendered on first visit (no
 *       build-time params). A hidden or unknown pool is the site 404; a superseded one keeps its
 *       page with a "Replaced by" link. Each slot's values under its mods are read at render
 *       (src/services/slot-values.ts: the mod_values cache, else the hinai mirror, else the math
 *       marked "no mod data"; a render the mirror failed shows the math until the next hour).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PoolView } from "@/components/pools/PoolView";
import { getMapSummaries, getPublicPool } from "@/services/pools";
import { pastSlotValues } from "@/services/slot-values";
import { openInPacksHref } from "@/utils/pack-input";
import { poolHeadline } from "@/utils/pool-text";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

const loadPool = cache(getPublicPool);

export async function generateMetadata({ params }: PageProps<"/pools/[id]">): Promise<Metadata> {
  const { id } = await params;
  const pool = await loadPool(id);
  if (!pool) return {};
  return {
    title: pool.name,
    description: `${poolHeadline(pool)}. ${pool.slots.length} maps, each with its tournament history.`,
    alternates: { canonical: `/pools/${pool._id}` },
  };
}

export default async function PoolPage({ params }: PageProps<"/pools/[id]">) {
  const { id } = await params;
  const pool = await loadPool(id);
  if (!pool) notFound();
  const maps = await getMapSummaries(pool.slots.map((slot) => slot.beatmapId));
  const { values } = await pastSlotValues(pool, maps);
  return <PoolView pool={pool} maps={maps} values={values} openInPacks={openInPacksHref(pool)} />;
}
