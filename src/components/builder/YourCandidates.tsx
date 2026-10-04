/**
 * @file src/components/builder/YourCandidates.tsx
 * @desc The map browser's "Your candidates" source: every candidate (and, with Include picks,
 *       every pick) from the pools you own or edit, newest first, filtered by the slot it came
 *       from and by text, with stars under the current bucket's mods; each one can be added as
 *       the pick or as a candidate (its note comes along). Paged 50 at a time. Signed-in
 *       editors only (it's in the editor).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import type { BucketEntry } from "@haruhimemoe/pool";
import { Checkbox, Notice, Pagination, Select, Text, TextInput } from "@haruhimemoe/ui";
import { useId, useState } from "react";
import { YourCandidateRow } from "@/components/builder/YourCandidateRow";
import { YOUR_CANDIDATES, YOUR_CANDIDATES_TEXT } from "@/constants/candidates";
import { useYourCandidates, type YourCandidatesFilters } from "@/hooks/useYourCandidates";
import type { Fetcher } from "@/lib/pool-client";
import type { CandidateAdder } from "@/schemas/candidate-editor";

type YourCandidatesProps = {
  poolId: string;
  buckets: readonly BucketEntry[];
  /** The bucket whose mods the stars are under. */
  under: string;
  defaultBucket: string | null;
  poolIds: ReadonlySet<number>;
  onAdd: (beatmapId: number, bucket: string | null) => void;
  adder: CandidateAdder;
  /** Changes when the list should be asked for again (the pool saved a change). */
  refresh: number;
  fetcher?: Fetcher | undefined;
};

const ANY = "";

/**
 * @function YourCandidates
 * @param props {YourCandidatesProps} the pool, its buckets, the current bucket and the add calls
 * @returns {JSX.Element} the filters, the list and its pages
 */
export function YourCandidates(props: YourCandidatesProps) {
  const { poolId, buckets, under, defaultBucket, poolIds, onAdd, adder, refresh, fetcher } = props;
  const ids = { q: useId(), bucket: useId(), picks: useId() };
  const [filters, setFilters] = useState<YourCandidatesFilters>({
    bucket: null,
    q: "",
    picks: false,
    page: 1,
  });
  const set = (change: Partial<YourCandidatesFilters>) =>
    setFilters((was) => ({ ...was, page: 1, ...change }));
  const list = useYourCandidates(poolId, under, filters, refresh, fetcher);
  const data = list.data;
  const count = data ? `${data.total} ${data.total === 1 ? "map" : "maps"}` : "Loading…";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <TextInput
          id={ids.q}
          label="Search your candidates"
          hint="Map, mapper, pool or note."
          value={filters.q}
          maxLength={YOUR_CANDIDATES.maxQuery}
          autoComplete="off"
          onChange={(event) => set({ q: event.target.value })}
        />
        <Select
          id={ids.bucket}
          label="From slot"
          value={filters.bucket ?? ANY}
          onChange={(event) => set({ bucket: event.target.value || null })}
        >
          <option value={ANY}>Any slot</option>
          {buckets.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.code}
            </option>
          ))}
        </Select>
      </div>
      <Checkbox
        id={ids.picks}
        label={YOUR_CANDIDATES_TEXT.picksToo}
        checked={filters.picks}
        onChange={(event) => set({ picks: event.target.checked })}
      />
      <Text tone="muted" aria-live="polite">
        {list.status === "loading" ? "Loading…" : count}
        {data ? ` · stars under ${data.under === "NM" ? "no mod" : data.under}` : ""}
      </Text>
      {list.status === "error" ? (
        <Notice tone="warning">{`${YOUR_CANDIDATES_TEXT.failed} ${list.message}`}</Notice>
      ) : data && data.total === 0 ? (
        <Text tone="muted">{YOUR_CANDIDATES_TEXT.empty}</Text>
      ) : null}
      {data && data.rows.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {data.rows.map((row) => (
            <YourCandidateRow
              key={`${row.poolId}:${row.bucket}:${row.index}:${row.kind}:${row.beatmapId}`}
              row={row}
              buckets={buckets}
              defaultBucket={defaultBucket}
              inPool={poolIds.has(row.beatmapId)}
              onAdd={onAdd}
              adder={adder}
            />
          ))}
        </ul>
      ) : null}
      {data ? (
        <Pagination
          aria-label="Candidate pages"
          page={data.page}
          pageCount={data.pages}
          hasNext={data.page < data.pages}
          onPageChange={(page) => setFilters((was) => ({ ...was, page }))}
        />
      ) : null}
    </div>
  );
}
