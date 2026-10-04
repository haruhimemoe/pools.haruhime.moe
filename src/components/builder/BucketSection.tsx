/**
 * @file src/components/builder/BucketSection.tsx
 * @desc One bucket in the editor: its code and what it plays with, "Find maps" (opens the map
 *       browser for it), "Remove slot" for an empty custom bucket, and its maps in order. Maps
 *       with no slot get a group of their own, with no Find maps. Each map shows its values
 *       under the bucket's mods once known, and a badge when its stars fall outside the
 *       bucket's target range; a row under the maps says how many more the target wants ("2 more
 *       NM maps"). Its rows, candidates included, are BucketRows. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { isCustomBucket } from "@haruhimemoe/pool";
import { Button, cx, Text } from "@haruhimemoe/ui";
import { useId } from "react";
import { BucketRows, type SlotActions } from "@/components/builder/BucketRows";
import type { MoveTarget } from "@/components/builder/SlotRow";
import type { SlotDrag } from "@/hooks/useSlotDrag";
import type { BucketTarget, SlotNotes } from "@/schemas/built-plan";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import type { CandidateContext } from "@/schemas/candidate-editor";
import { placeholderText, rangeBadgeText, rangeSide } from "@/utils/bucket-targets";
import { groupHeading, type SlotGroup } from "@/utils/built-editor";
import { starsUnderMods } from "@/utils/built-summary";
import { groupSlotCode, type SlotValueMap } from "@/utils/slot-values";

type BucketSectionProps = SlotActions & {
  group: SlotGroup;
  maps: BuiltMaps;
  /** Values under each slot's mods, as far as they're known. */
  values: SlotValueMap;
  /** Every bucket a map can move to. */
  targets: readonly MoveTarget[];
  /** The bucket's target: placeholders up to its count, badges outside its range. */
  plan?: BucketTarget | undefined;
  /** Each slot's note by beatmap id. */
  notes: SlotNotes;
  /** Dragging slots between rows and buckets. */
  drag?: SlotDrag | undefined;
  /** The slots' candidates and their actions (the editor only). */
  candidates?: CandidateContext | undefined;
  onFind: (code: string) => void;
  onRemoveBucket: (code: string) => void;
};

/**
 * @function BucketSection
 * @param props {BucketSectionProps} the bucket, its slots and the slot actions
 * @returns {JSX.Element} one bucket's heading, target, Find maps and rows, as a drop target
 */
export function BucketSection(props: BucketSectionProps) {
  const { group, maps, values, targets, plan, notes, drag, candidates, ...on } = props;
  const headingId = useId();
  const { title, detail } = groupHeading(group.entry);
  const { code, entry, slots } = group;
  const over = drag?.over?.bucket === code && drag.over.index === null;
  const others = targets.filter((target) => target.code !== code);
  const missing = code === null ? 0 : (plan?.count ?? 0) - slots.length;
  const hasCandidates =
    code !== null &&
    Object.keys(candidates?.candidates ?? {}).some((key) => key.startsWith(`${code}:`));
  const badgeOf = (slot: (typeof slots)[number]) => {
    const side = rangeSide(starsUnderMods(slot, entry, maps, values), plan?.sr);
    return side && plan?.sr ? rangeBadgeText(side, plan.sr) : null;
  };
  return (
    <section
      aria-labelledby={headingId}
      data-bucket={code ?? ""}
      data-drop-bucket={code ?? ""}
      {...drag?.target()}
      className={cx(
        "flex flex-col rounded-lg",
        over && "outline-dashed outline-2 outline-h1 outline-offset-4",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} tabIndex={-1} className="font-bold text-c1">
          {title}
          {detail ? (
            <Text as="span" tone="muted">
              {" "}
              {detail}
            </Text>
          ) : null}
        </h3>
        {code !== null ? (
          <div className="flex gap-2">
            {entry && isCustomBucket(entry) && slots.length === 0 ? (
              <Button
                variant="ghost"
                aria-label={`Remove slot ${code}`}
                onClick={() => on.onRemoveBucket(code)}
              >
                Remove slot
              </Button>
            ) : null}
            <Button
              variant="secondary"
              data-control="find"
              aria-label={`Find maps for ${code}`}
              onClick={() => on.onFind(code)}
            >
              Find maps
            </Button>
          </div>
        ) : null}
      </div>
      {slots.length === 0 && missing <= 0 && !hasCandidates ? (
        <Text tone="muted" className="py-2">
          No maps yet.
        </Text>
      ) : (
        <BucketRows
          code={code}
          slots={slots}
          combo={(slot) => groupSlotCode(slot, entry)}
          maps={maps}
          values={values}
          targets={others}
          notes={notes}
          badgeOf={badgeOf}
          drag={drag}
          candidates={candidates}
          onNote={on.onNote}
          onMove={on.onMove}
          onMoveTo={on.onMoveTo}
          onRemove={on.onRemove}
        />
      )}
      {missing > 0 && code !== null ? (
        <Text
          data-placeholder
          tone="muted"
          className="mt-2 rounded-lg border border-b1 border-dashed px-3 py-2"
        >
          {placeholderText(code, missing)}
        </Text>
      ) : null}
    </section>
  );
}
