/**
 * @file src/app/pools/[id]/page.tsx
 * @desc /pools/[id]: a pool's public page. Cookie-free ISR, hourly, rendered on first visit (no
 *       build-time params). A hidden or unknown pool is the site 404; a superseded one keeps its
 *       page with a "Replaced by" link. Each slot's values under its mods are read at render
 *       (src/services/slot-values.ts: the mod_values cache, else the hinai mirror, else the math
 *       marked "no mod data"; a render the mirror failed shows the math until the next hour).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PoolView } from "@/components/pools/PoolView";
import { getMapSummaries, getPublicPool } from "@/services/pools";
import { pastSlotValues } from "@/services/slot-values";
import { openInPacksHref } from "@/utils/pack-input";
import { poolHeadline } from "@/utils/pool-text";

/** ISR: rebuilt at most once an hour, and on an admin's Refresh public pages. */
export const revalidate = 3600;

/**
 * @function generateStaticParams
 * @returns {{ id: string }[]} none at build: pool pages build on first visit
 */
export function generateStaticParams() {
  return [];
}

const loadPool = cache(getPublicPool);

/**
 * @function generateMetadata
 * @param props {PageProps<"/pools/[id]">} the pool's id
 * @returns {Promise<Metadata>} the pool's title, description and canonical URL
 */
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

/**
 * @function PoolPage
 * @param props {PageProps<"/pools/[id]">} the pool's id
 * @returns {Promise<JSX.Element>} a past pool's page (cookie-free), or a 404 for a hidden or
 *          missing one
 */
export default async function PoolPage({ params }: PageProps<"/pools/[id]">) {
  const { id } = await params;
  const pool = await loadPool(id);
  if (!pool) notFound();
  const maps = await getMapSummaries(pool.slots.map((slot) => slot.beatmapId));
  const { values } = await pastSlotValues(pool, maps);
  return <PoolView pool={pool} maps={maps} values={values} openInPacks={openInPacksHref(pool)} />;
}
