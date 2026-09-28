/**
 * @file src/components/maps/MapView.tsx
 * @desc A map page: cover, "Artist - Title [Difficulty]", its usage line, links to osu! and the
 *       mirror, details (set host, no-mod stars, length, BPM, AR, OD, CS, HP, mode) and its
 *       tournament history. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { setDownloadUrl } from "@haruhimemoe/hinai";
import { beatmapUrl, coverUrl } from "@haruhimemoe/osu/shapes";
import { BeatmapStats, ButtonLink, Card, PageHeader, StarRating } from "@haruhimemoe/ui";
import Image from "next/image";
import type { ReactNode } from "react";
import { MapHistoryTable } from "@/components/maps/MapHistoryTable";
import type { StoredMap } from "@/schemas/map";
import type { HistoryRow } from "@/utils/history";
import { mapLabel } from "@/utils/map-record";
import { usageSummary } from "@/utils/usage";

/**
 * @function MapView
 * @param props {{ map: StoredMap; history: readonly HistoryRow[] }} the map and the current pools
 *        it's in
 * @returns {JSX.Element} the map's page: cover, header and links, details and history
 */
export function MapView({ map, history }: { map: StoredMap; history: readonly HistoryRow[] }) {
  const details: [string, ReactNode][] = [
    ["Set host", map.setHost ?? "Not known"],
    ["Stars (no mod)", map.stars === null ? "–" : <StarRating key="stars" value={map.stars} />],
  ];
  return (
    <article className="flex flex-col gap-6">
      {map.setId !== null ? (
        <Image
          src={coverUrl(map.setId, "cover")}
          alt=""
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
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          {details.map(([term, value]) => (
            <div key={term}>
              <dt className="text-c3">{term}</dt>
              <dd className="font-bold text-c1 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
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
        {history.length === 0 ? (
          <p className="text-c3 text-sm">No current pool uses this map.</p>
        ) : (
          <MapHistoryTable rows={history} />
        )}
      </Card>
    </article>
  );
}
