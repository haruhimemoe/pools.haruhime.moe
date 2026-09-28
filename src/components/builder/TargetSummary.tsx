/**
 * @file src/components/builder/TargetSummary.tsx
 * @desc The summary's part on targets, shown when the pool has any: buckets short of their
 *       count ("3 of 5 maps (2 more)"), and, when a target has a star range, the maps whose
 *       stars under their slot's mods sit outside it. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatStars } from "@haruhimemoe/osu/format";
import { useId } from "react";
import type { BucketTargets } from "@/schemas/built-plan";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import { targetGaps, targetRangeText, targetsOutOfRange } from "@/utils/bucket-targets";
import type { SlotGroup } from "@/utils/built-editor";
import type { SlotValueMap } from "@/utils/slot-values";

type TargetSummaryProps = {
  groups: readonly SlotGroup[];
  targets: BucketTargets;
  maps: BuiltMaps;
  values: SlotValueMap;
};

const H3 = "font-bold text-c1";
const maps = (n: number) => `${n} ${n === 1 ? "map" : "maps"}`;

/**
 * @function TargetSummary
 * @param props {TargetSummaryProps} the buckets, their targets, maps and values
 * @returns {JSX.Element} each target's count and star range against the pool, with what's out of
 *          range
 */
export function TargetSummary({ groups, targets, maps: details, values }: TargetSummaryProps) {
  const shortId = useId();
  const rangeId = useId();
  const gaps = targetGaps(groups, targets);
  const outside = targetsOutOfRange(groups, details, values, targets);
  const ranged = Object.values(targets).some((target) => target.sr);
  return (
    <>
      <section aria-labelledby={shortId} className="flex flex-col gap-1">
        <h3 id={shortId} className={H3}>
          Targets short of maps
        </h3>
        {gaps.length === 0 ? (
          <p className="text-c3">Every slot has the maps its target asks for.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {gaps.map((gap) => (
              <div key={gap.code} className="contents">
                <dt className="font-bold text-c2">{gap.code}</dt>
                <dd className="tabular-nums">
                  {gap.have} of {maps(gap.want)} ({gap.missing} more)
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      {ranged ? (
        <section aria-labelledby={rangeId} className="flex flex-col gap-1">
          <h3 id={rangeId} className={H3}>
            Maps outside their star range
          </h3>
          {outside.length === 0 ? (
            <p className="text-c3">Every map with known stars is in its slot's range.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {outside.map((map) => (
                <li key={map.beatmapId}>
                  <span className="font-bold text-c2">{map.slot}</span> {formatStars(map.stars)}★,{" "}
                  {map.side} {targetRangeText(map.sr)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
