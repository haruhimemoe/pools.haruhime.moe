/**
 * @file src/components/maps/MapView.tsx
 * @desc A map page: cover, "Artist - Title [Difficulty]", its usage line, links to osu! and the
 *       mirror, details (set host, no-mod stars, length, BPM, AR, OD, CS, HP, mode) and its
 *       tournament history, under one sentence saying how often and how it was played and where
 *       last. The cover's alt names the song. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { setDownloadUrl } from "@haruhimemoe/hinai";
import { beatmapUrl, coverUrl } from "@haruhimemoe/osu/shapes";
import {
  BeatmapStats,
  ButtonLink,
  Card,
  PageHeader,
  StarRating,
  StatList,
  Text,
} from "@haruhimemoe/ui";
import Image from "next/image";
import type { ReactNode } from "react";
import { MapHistoryTable } from "@/components/maps/MapHistoryTable";
import type { StoredMap } from "@/schemas/map";
import type { HistoryRow } from "@/utils/history";
import { mapLabel } from "@/utils/map-record";
import { usageSummary } from "@/utils/usage";

/**
 * @function MapView
 * @param props {{ map: StoredMap; history: readonly HistoryRow[]; sentence?: string }} the map,
 *        the current pools it's in, and the line about its history
 * @returns {JSX.Element} the map's page: cover, header and links, details and history
 */
export function MapView({
  map,
  history,
  sentence,
}: {
  map: StoredMap;
  history: readonly HistoryRow[];
  sentence?: string;
}) {
  const details: [string, ReactNode][] = [
    ["Set host", map.setHost ?? "Not known"],
    ["Stars (no mod)", map.stars === null ? "–" : <StarRating key="stars" value={map.stars} />],
  ];
  return (
    <article className="flex flex-col gap-6">
      {map.setId !== null ? (
        <Image
          src={coverUrl(map.setId, "cover")}
          alt={map.title ? `${map.artist ?? "Unknown artist"} - ${map.title} cover` : ""}
          width={900}
          height={250}
          className="h-auto w-full rounded-lg object-cover"
        />
      ) : null}
      <PageHeader
        title={mapLabel(map, map._id)}
        lead={usageSummary(map.usage)}
        meta={`Beatmap ${map._id}`}
        actions={
          <>
            <ButtonLink href={beatmapUrl(map._id)} variant="secondary">
              Open on osu!
            </ButtonLink>
            {map.setId !== null ? (
              <ButtonLink href={setDownloadUrl(map.setId)} variant="secondary">
                Download from the mirror
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <Card title="Details">
        <StatList
          variant="grid"
          items={details.map(([label, value]) => ({ label, value }))}
          className="text-sm"
        />
        <BeatmapStats
          cs={map.cs}
          ar={map.ar}
          od={map.od}
          hp={map.hp}
          bpm={map.bpm}
          lengthSeconds={map.length}
          className="mt-3 text-sm"
        />
      </Card>
      <Card title="Tournament history">
        {sentence ? <p className="mb-3 text-c2">{sentence}</p> : null}
        {history.length === 0 ? (
          <Text tone="muted">No current pool uses this map.</Text>
        ) : (
          <MapHistoryTable rows={history} />
        )}
      </Card>
    </article>
  );
}
