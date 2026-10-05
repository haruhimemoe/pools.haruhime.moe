/**
 * @file src/components/builder/CandidateRow.tsx
 * @desc One candidate under a slot in the editor: a drag handle (a button named for the candidate),
 *       its cover and preview clip, its map with stars under the slot's
 *       mods, who added it, its note, its votes ("2 of 3 editors") with the viewer's own vote as
 *       a toggle, Promote and Remove. Every control names the map and slot. Presentational. Find similar opens the
 *       map browser on maps like it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import {
  Button,
  cx,
  MapCard,
  MapPreviewButton,
  SORTABLE_ITEM,
  type Sortable,
  SortableHandle,
  Text,
} from "@haruhimemoe/ui";
import { FindSimilarButton } from "@/components/builder/FindSimilarButton";
import { SlotNote } from "@/components/builder/SlotNote";
import type { Candidate } from "@/schemas/built-candidates";
import type { BuiltMap } from "@/schemas/built-pool-view";
import type { CandidateActions } from "@/schemas/candidate-editor";
import { slotFacts, toMapData } from "@/utils/map-card";
import { songOf } from "@/utils/map-preview";
import { mapLabel } from "@/utils/map-record";
import type { SlotValueAnswer } from "@/utils/slot-values";
import { candidateId, candidateListId } from "@/utils/sortable-ids";

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
  /** Its place in the candidate list, for dragging. */
  position: number;
  sortable: Sortable;
};

/**
 * @function CandidateRow
 * @param props {CandidateRowProps} the candidate, its slot, map, values, who added it, its votes
 *        and the actions
 * @returns {JSX.Element} one candidate as a list item
 */
export function CandidateRow(props: CandidateRowProps) {
  const { entry, label, place, map, values, addedBy, votes, voted, position, sortable, ...on } =
    props;
  const name = `${mapLabel(map, entry.beatmapId)} (${label} candidate)`;
  const id = candidateId(place, entry.beatmapId);
  const facts = slotFacts(values, map);
  const setId = entry.beatmapsetId ?? map?.setId;
  return (
    <MapCard
      as="li"
      data-candidate={entry.beatmapId}
      {...sortable.item(id, { container: candidateListId(place), index: position, label: name })}
      className={cx("rounded-none border-b3 border-t bg-transparent px-0 py-2", SORTABLE_ITEM)}
      beatmapId={entry.beatmapId}
      map={toMapData(map)}
      href={null}
      leading={<SortableHandle sortable={sortable} id={id} className="self-start" />}
      preview={
        setId ? (
          <MapPreviewButton beatmapsetId={setId} song={songOf(map, entry.beatmapId)} />
        ) : undefined
      }
      stars={facts.stars}
      starsNote={facts.starsNote}
      stats={facts.stats}
      details={
        <>
          {facts.note ? (
            <Text as="span" size="xs" tone="muted">
              {facts.note}
            </Text>
          ) : null}
          <Text as="span" size="xs" tone="muted">
            {addedBy}
          </Text>
          <SlotNote
            beatmapId={entry.beatmapId}
            label={name}
            note={entry.note || undefined}
            onSave={(note) => on.onNote(entry, note)}
          />
        </>
      }
      actions={
        <>
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
          <FindSimilarButton beatmapId={entry.beatmapId} label={mapLabel(map, entry.beatmapId)} />
          <Button
            variant="ghost"
            data-control="remove-candidate"
            aria-label={`Remove ${name}`}
            onClick={() => on.onRemove(entry)}
          >
            Remove
          </Button>
        </>
      }
    />
  );
}
