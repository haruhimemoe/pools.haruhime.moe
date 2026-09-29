/**
 * @file src/app/maps/[id]/page.tsx
 * @desc /maps/[id]: a map's public page with its tournament history. Cookie-free ISR, hourly,
 *       rendered on first visit. 404 for an id that isn't a whole number, a map we don't have,
 *       and a map whose pools are all hidden; a map whose pools are all superseded shows "no
 *       current pools". Indexed only once 2 or more current pools use it (the rest are noindex,
 *       follow, and out of the sitemap); a CreativeWork and breadcrumbs as JSON-LD.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { notFoundMetadata, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { JsonLd } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MapView } from "@/components/maps/MapView";
import { SEO_SITE } from "@/constants/seo";
import { getMapHistory, getPublicMap } from "@/services/maps";
import { mapLabel } from "@/utils/map-record";
import { isMapIndexed, mapLd, mapSentence } from "@/utils/page-seo";

/** ISR: rebuilt at most once an hour, and on an admin's Refresh public pages. */
export const revalidate = 3600;

/**
 * @function generateStaticParams
 * @returns {{ id: string }[]} none at build: map pages build on first visit
 */
export function generateStaticParams() {
  return [];
}

const idOf = (raw: string): number | null => (/^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null);

const loadMap = cache(async (raw: string) => {
  const id = idOf(raw);
  return id === null ? null : getPublicMap(id);
});

const loadHistory = cache(getMapHistory);

/**
 * @function generateMetadata
 * @param props {PageProps<"/maps/[id]">} the beatmap id
 * @returns {Promise<Metadata>} the map's title, its sentence as the description, canonical URL
 *          and link preview (noindex under 2 pools), or "Map not found"
 */
export async function generateMetadata({ params }: PageProps<"/maps/[id]">): Promise<Metadata> {
  const { id } = await params;
  const map = await loadMap(id);
  if (!map) return notFoundMetadata(SEO_SITE, "Map");
  return pageMetadata(SEO_SITE, {
    path: `/maps/${map._id}`,
    title: mapLabel(map, map._id),
    description: mapSentence(map, await loadHistory(map._id)),
    index: isMapIndexed(map.usage),
  });
}

/**
 * @function MapPage
 * @param props {PageProps<"/maps/[id]">} the beatmap id
 * @returns {Promise<JSX.Element>} the map and the current pools it's in, or a 404
 */
export default async function MapPage({ params }: PageProps<"/maps/[id]">) {
  const { id } = await params;
  const map = await loadMap(id);
  if (!map) notFound();
  const history = await loadHistory(map._id);
  const sentence = mapSentence(map, history);
  return (
    <>
      <JsonLd data={mapLd(map, history, sentence)} />
      <MapView map={map} history={history} sentence={sentence} />
    </>
  );
}
