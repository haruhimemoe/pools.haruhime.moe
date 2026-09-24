/**
 * @file src/app/maps/[id]/page.tsx
 * @desc /maps/[id]: a map's public page with its tournament history. Cookie-free ISR, hourly,
 *       rendered on first visit. 404 for an id that isn't a whole number, a map we don't have,
 *       and a map whose pools are all hidden; a map whose pools are all superseded shows "no
 *       current pools".
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MapView } from "@/components/maps/MapView";
import { getMapHistory, getPublicMap } from "@/services/maps";
import { mapLabel } from "@/utils/map-record";
import { usageSummary } from "@/utils/usage";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

const idOf = (raw: string): number | null => (/^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null);

const loadMap = cache(async (raw: string) => {
  const id = idOf(raw);
  return id === null ? null : getPublicMap(id);
});

export async function generateMetadata({ params }: PageProps<"/maps/[id]">): Promise<Metadata> {
  const { id } = await params;
  const map = await loadMap(id);
  if (!map) return {};
  return {
    title: mapLabel(map, map._id),
    description: `${usageSummary(map.usage)}. Tournament history for this osu! map.`,
    alternates: { canonical: `/maps/${map._id}` },
  };
}

export default async function MapPage({ params }: PageProps<"/maps/[id]">) {
  const { id } = await params;
  const map = await loadMap(id);
  if (!map) notFound();
  return <MapView map={map} history={await getMapHistory(map._id)} />;
}
