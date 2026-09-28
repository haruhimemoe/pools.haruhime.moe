/**
 * @file src/components/builder/PoolSummary.tsx
 * @desc A built pool's summary, on its page and in the editor: how many maps, each bucket's star
 *       range (each map under its slot's mods when known), beatmapsets in more than one slot,
 *       and the maps past pools played (linking each map's history). Presentational; the content rules check sits
 *       beside it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import Link from "next/link";
import { MAX_SLOTS } from "@/constants/built-pools";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { groupSlots } from "@/utils/built-editor";
import { playedBefore, repeatedSets, type StarRange, starRanges } from "@/utils/built-summary";
import { formatRange, formatStars } from "@/utils/format";
import type { SlotValueMap } from "@/utils/slot-values";
import { usageSummary } from "@/utils/usage";

type PoolSummaryProps = {
  pool: { buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] };
  maps: BuiltMaps;
  /** Values under each slot's mods, as far as they're known. */
  values?: SlotValueMap;
};

const rangeText = ({ low, high, maps, known }: StarRange): string => {
  const range = low === null || high === null ? "–" : `${formatRange(low, high, formatStars)}★`;
  return known === maps ? range : `${range} (${known} of ${maps} known)`;
};

const H3 = "font-bold text-c1";

export function PoolSummary({ pool, maps, values = {} }: PoolSummaryProps) {
  const groups = groupSlots(pool);
  const ordered = groups.flatMap((group) => group.slots);
  const ranges = starRanges(groups, maps, values);
  const repeats = repeatedSets(ordered, maps);
  const played = playedBefore(ordered, maps);
  const count = pool.slots.length;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="font-bold text-c1">
        {count} {count === 1 ? "map" : "maps"} of {MAX_SLOTS}
      </p>
      <section className="flex flex-col gap-1">
        <h3 className={H3}>Star range per slot (with its mods)</h3>
        {ranges.length === 0 ? (
          <p className="text-c3">No maps yet.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {ranges.map((range) => (
              <div key={range.title} className="contents">
                <dt className="font-bold text-c2">{range.title}</dt>
                <dd className="tabular-nums">{rangeText(range)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section className="flex flex-col gap-1">
        <h3 className={H3}>Same beatmapset twice</h3>
        {repeats.length === 0 ? (
          <p className="text-c3">No beatmapset is in two slots.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {repeats.map((repeat) => (
              <li key={repeat.setId}>
                {repeat.name}: {repeat.slots.join(", ")}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-1">
        <h3 className={H3}>Played in past pools</h3>
        {played.length === 0 ? (
          <p className="text-c3">None of these maps were in a past pool.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {played.map((map) => (
              <li key={map.beatmapId}>
                <span className="font-bold text-c2">{map.slot}</span>{" "}
                <Link href={`/maps/${map.beatmapId}`} className="hover:text-c1 hover:underline">
                  {map.label}
                </Link>
                <span className="text-c3">: {usageSummary(map)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
