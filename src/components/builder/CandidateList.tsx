/**
 * @file src/components/builder/CandidateList.tsx
 * @desc A slot's candidates in the editor, under its pick: ui's Disclosure with "N candidates"
 *       (open or closed as the bucket's rows keep it: open from the start for a slot with no
 *       pick), each one a CandidateRow with its stars
 *       under the slot's mods, who added it, its note and votes. The whole list, button included,
 *       is a drop target (`data-drop-zone="candidates"`): a pick dropped there is demoted, a
 *       candidate from another slot of the bucket moves there. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { cx, Disclosure } from "@haruhimemoe/ui";
import { CandidateRow } from "@/components/builder/CandidateRow";
import type { SlotDrag } from "@/hooks/useSlotDrag";
import type { Candidate } from "@/schemas/built-candidates";
import type { BuiltMaps, PoolPerson } from "@/schemas/built-pool-view";
import type { CandidateActions } from "@/schemas/candidate-editor";
import { votesText } from "@/utils/candidate-view";
import { type SlotValueMap, slotValueKey } from "@/utils/slot-values";

type CandidateListProps = CandidateActions & {
  place: { bucket: string; index: number };
  /** The slot's label ("NM2"). */
  label: string;
  list: readonly Candidate[];
  maps: BuiltMaps;
  values: SlotValueMap;
  /** The slot's combo for values ("<id>:<combo>" keys). */
  combo: string;
  /** The owner and editors: who may vote, and names for "added by". */
  members: readonly PoolPerson[];
  /** The viewer's osu! id. */
  me: number | undefined;
  /** Whether it's open, and the call that changes it (the rows keep it by slot). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drag?: SlotDrag | undefined;
};

/**
 * @function CandidateList
 * @param props {CandidateListProps} the slot, its candidates, their details and values, who may
 *        vote, and the actions
 * @returns {JSX.Element} the collapsible list, as a drop target
 */
export function CandidateList(props: CandidateListProps) {
  const { place, label, list, maps, values, combo, members, me, open, onOpenChange, drag, ...on } =
    props;
  const ids = members.map((person) => person.osuId);
  const nameOf = (osuId: number) =>
    members.find((person) => person.osuId === osuId)?.username ?? "a former editor";
  const over =
    drag?.over?.zone === "candidates" &&
    drag.over.bucket === place.bucket &&
    drag.over.index === place.index;
  const count = `${list.length} ${list.length === 1 ? "candidate" : "candidates"}`;
  return (
    <Disclosure
      summary={
        <span>
          {count}
          <span className="sr-only">{` for ${label}`}</span>
        </span>
      }
      open={open}
      onOpenChange={onOpenChange}
      data-drop-bucket={place.bucket}
      data-drop-index={place.index}
      data-drop-zone="candidates"
      {...drag?.target()}
      className={cx("@lg:ml-8 rounded-lg px-2 py-1", over && "outline-dashed outline-2 outline-h1")}
    >
      <ol className="flex flex-col">
        {list.map((entry) => (
          <CandidateRow
            key={entry.beatmapId}
            entry={entry}
            label={label}
            place={place}
            map={maps[entry.beatmapId]}
            values={values[slotValueKey(entry.beatmapId, combo)]}
            addedBy={`added by ${nameOf(entry.addedBy)}`}
            votes={votesText(entry, ids)}
            voted={me !== undefined && entry.votes.includes(me)}
            drag={drag}
            {...on}
          />
        ))}
      </ol>
    </Disclosure>
  );
}
