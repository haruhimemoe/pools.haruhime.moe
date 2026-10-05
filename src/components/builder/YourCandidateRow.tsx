/**
 * @file src/components/builder/YourCandidateRow.tsx
 * @desc One map in "Your candidates": its cover and clip, its name with stars under the current
 *       bucket's mods, where it's from (pool, slot, candidate or pick) and its note, then Add (as
 *       the pick, like a search result) and Add as candidate (the note comes along; votes don't).
 *       Presentational. Find similar opens the
 *       map browser on maps like it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { type BucketEntry, slotLabel } from "@haruhimemoe/pool";
import { MapCard, MapPreviewButton, Text } from "@haruhimemoe/ui";
import { AddAsCandidate } from "@/components/builder/AddAsCandidate";
import { AddToPool } from "@/components/builder/AddToPool";
import { FindSimilarButton } from "@/components/builder/FindSimilarButton";
import type { CandidateAdder } from "@/schemas/candidate-editor";
import type { YourCandidateRow as Row } from "@/schemas/your-candidates";
import { slotFacts, toMapData } from "@/utils/map-card";
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
  const facts = slotFacts(row.values ?? undefined, row.map);
  return (
    <MapCard
      as="li"
      data-own={row.beatmapId}
      beatmapId={row.beatmapId}
      map={toMapData(row.map)}
      href={null}
      preview={
        row.beatmapsetId ? (
          <MapPreviewButton beatmapsetId={row.beatmapsetId} song={songOf(row.map, row.beatmapId)} />
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
            {from}
          </Text>
          {row.note ? (
            <Text tone="default" className="break-words">
              {row.note}
            </Text>
          ) : null}
        </>
      }
      actions={
        <>
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
        </>
      }
    />
  );
}
