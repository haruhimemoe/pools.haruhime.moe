/**
 * @file src/components/builder/YourCandidateRow.tsx
 * @desc One map in "Your candidates": its cover and clip, its name with stars under the current
 *       bucket's mods, where it's from (pool, slot, candidate or pick) and its note, then Add (as
 *       the pick, like a search result) and Add as candidate (the note comes along; votes don't).
 *       Presentational. Find similar opens the
 *       map browser on maps like it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { type BucketEntry, slotLabel } from "@haruhimemoe/pool";
import { AddAsCandidate } from "@/components/builder/AddAsCandidate";
import { AddToPool } from "@/components/builder/AddToPool";
import { FindSimilarButton } from "@/components/builder/FindSimilarButton";
import { MapPreview } from "@/components/builder/MapPreview";
import { SlotMapText } from "@/components/builder/SlotMapText";
import type { CandidateAdder } from "@/schemas/candidate-editor";
import type { YourCandidateRow as Row } from "@/schemas/your-candidates";
import { songOf } from "@/utils/map-preview";
import { mapLabel } from "@/utils/map-record";

type YourCandidateRowProps = {
  row: Row;
  buckets: readonly BucketEntry[];
  defaultBucket: string | null;
  /** The map is a pick in this pool already. */
  inPool: boolean;
  onAdd: (beatmapId: number, bucket: string | null) => void;
  adder: CandidateAdder;
};

/**
 * @function YourCandidateRow
 * @param props {YourCandidateRowProps} the row, the pool's buckets, the default bucket and the
 *        add calls
 * @returns {JSX.Element} one map as a list item
 */
export function YourCandidateRow(props: YourCandidateRowProps) {
  const { row, buckets, defaultBucket, inPool, onAdd, adder } = props;
  const version = row.map?.version ?? mapLabel(row.map, row.beatmapId);
  const from = `${row.poolName} · ${slotLabel({ mod: row.bucket, index: row.index })} ${row.kind}`;
  return (
    <li data-own={row.beatmapId} className="flex flex-col gap-2 rounded-lg bg-b4 p-3">
      <div className="flex min-w-0 gap-3">
        <MapPreview setId={row.beatmapsetId} song={songOf(row.map, row.beatmapId)} />
        <div className="flex min-w-0 flex-col gap-1">
          <SlotMapText beatmapId={row.beatmapId} map={row.map} values={row.values ?? undefined} />
          <p className="text-c3 text-xs">{from}</p>
          {row.note ? <p className="break-words text-c2 text-sm">{row.note}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <AddToPool
          beatmapId={row.beatmapId}
          version={version}
          buckets={buckets}
          defaultBucket={defaultBucket}
          inPool={inPool}
          onAdd={onAdd}
        />
        <AddAsCandidate
          beatmapId={row.beatmapId}
          beatmapsetId={row.beatmapsetId}
          version={version}
          defaultBucket={defaultBucket}
          note={row.note}
          adder={adder}
        />
        <FindSimilarButton beatmapId={row.beatmapId} label={mapLabel(row.map, row.beatmapId)} />
      </div>
    </li>
  );
}
