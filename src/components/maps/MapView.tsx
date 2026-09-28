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
import { formatBpm, formatDuration, formatStat } from "@haruhimemoe/osu/format";
import { beatmapUrl, coverUrl } from "@haruhimemoe/osu/shapes";
import { ButtonLink, Card, PageHeader } from "@haruhimemoe/ui";
import Image from "next/image";
import { MapHistoryTable } from "@/components/maps/MapHistoryTable";
import type { StoredMap } from "@/schemas/map";
import type { HistoryRow } from "@/utils/history";
import { mapLabel } from "@/utils/map-record";
import { starsText } from "@/utils/pool-text";
import { usageSummary } from "@/utils/usage";

const stat = (value: number | null, format: (n: number) => string): string =>
  value === null ? "–" : format(value);

export function MapView({ map, history }: { map: StoredMap; history: readonly HistoryRow[] }) {
  const details: [string, string][] = [
    ["Set host", map.setHost ?? "Not known"],
    ["Stars (no mod)", starsText(map.stars)],
    ["Length", stat(map.length, formatDuration)],
    ["BPM", stat(map.bpm, formatBpm)],
    ["AR", stat(map.ar, formatStat)],
    ["OD", stat(map.od, formatStat)],
    ["CS", stat(map.cs, formatStat)],
    ["HP", stat(map.hp, formatStat)],
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
