/**
 * @file src/components/builder/CandidateRow.tsx
 * @desc One candidate under a slot in the editor: a drag handle (hidden from screen readers; the
 *       buttons do the same), its cover and preview clip, its map with stars under the slot's
 *       mods, who added it, its note, its votes ("2 of 3 editors") with the viewer's own vote as
 *       a toggle, Promote and Remove. Every control names the map and slot. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button, cx } from "@haruhimemoe/ui";
import { MapPreview } from "@/components/builder/MapPreview";
import { SlotMapText } from "@/components/builder/SlotMapText";
import { SlotNote } from "@/components/builder/SlotNote";
import type { SlotDrag } from "@/hooks/useSlotDrag";
import type { Candidate } from "@/schemas/built-candidates";
import type { BuiltMap } from "@/schemas/built-pool-view";
import type { CandidateActions } from "@/schemas/candidate-editor";
import { songOf } from "@/utils/map-preview";
import { mapLabel } from "@/utils/map-record";
import type { SlotValueAnswer } from "@/utils/slot-values";

type CandidateRowProps = CandidateActions & {
  entry: Candidate;
  /** Its slot's label ("NM2"), for the controls' names. */
  label: string;
  /** Its slot's bucket and number, for dragging. */
  place: { bucket: string; index: number };
  map: BuiltMap | null | undefined;
  /** Its values under the slot's mods, once known. */
  values?: SlotValueAnswer | undefined;
  /** "added by owner" (or a former editor). */
  addedBy: string;
  /** "2 of 3 editors". */
  votes: string;
  /** The viewer voted for it. */
  voted: boolean;
  drag?: SlotDrag | undefined;
};

/**
 * @function CandidateRow
 * @param props {CandidateRowProps} the candidate, its slot, map, values, who added it, its votes
 *        and the actions
 * @returns {JSX.Element} one candidate as a list item
 */
export function CandidateRow(props: CandidateRowProps) {
  const { entry, label, place, map, values, addedBy, votes, voted, drag, ...on } = props;
  const name = `${mapLabel(map, entry.beatmapId)} (${label} candidate)`;
  const item = {
    mod: place.bucket,
    index: place.index,
    beatmapId: entry.beatmapId,
    candidate: true as const,
  };
  const dragged = drag?.dragging === entry.beatmapId;
  return (
    <li
      data-candidate={entry.beatmapId}
      className={cx("flex flex-col gap-2 border-b3 border-t py-2", dragged && "opacity-50")}
    >
      <div className="flex min-w-0 gap-3">
        {drag ? (
          <span
            data-drag-handle
            aria-hidden="true"
            title="Drag to promote or move"
            {...drag.handle(item)}
            className="flex h-6 w-5 shrink-0 cursor-grab touch-none select-none items-center justify-center self-start text-c3 hover:text-c1 active:cursor-grabbing"
          >
            ⋮⋮
          </span>
        ) : null}
        <MapPreview
          setId={entry.beatmapsetId ?? map?.setId ?? null}
          song={songOf(map, entry.beatmapId)}
        />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <SlotMapText beatmapId={entry.beatmapId} map={map} values={values} />
          <p className="text-c3 text-xs">{addedBy}</p>
          <SlotNote
            beatmapId={entry.beatmapId}
            label={name}
            note={entry.note || undefined}
            onSave={(note) => on.onNote(entry, note)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 @lg:pl-8">
        <Button
          variant={voted ? "primary" : "secondary"}
          aria-pressed={voted}
          aria-label={`${voted ? "Take back your vote for" : "Vote for"} ${name}: ${votes}`}
          onClick={() => on.onVote(entry, !voted)}
        >
          {voted ? "Voted" : "Vote"} · {votes}
        </Button>
        <Button
          variant="secondary"
          data-control="promote"
          aria-label={`Promote ${name} to pick`}
          onClick={() => on.onPromote(entry)}
        >
          Promote
        </Button>
        <Button
          variant="ghost"
          data-control="remove-candidate"
          aria-label={`Remove ${name}`}
          onClick={() => on.onRemove(entry)}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
