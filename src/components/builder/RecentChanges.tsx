/**
 * @file src/components/builder/RecentChanges.tsx
 * @desc "Recent changes" in the editor: the pool's last 20 changes from its activity log (who,
 *       what, and when), asked for when the editor opens and again whenever the pool's version
 *       moves (a save, or someone else's change coming in). Only the owner and editors get it.
 *       A failed ask keeps the list it had and says so. A "Full history" link goes to the pool's
 *       version history page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { LinkRow, Text } from "@haruhimemoe/ui";
import { useEffect, useState } from "react";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientActivity } from "@/schemas/activity";
import { activityWhen } from "@/utils/activity";

type RecentChangesProps = { poolId: string; version: number; fetcher: Fetcher };

/**
 * @function RecentChanges
 * @param props {RecentChangesProps} the pool's id and version, and a fetcher (tests)
 * @returns {JSX.Element} the last 20 changes, asked again whenever the version moves
 */
export function RecentChanges({ poolId, version, fetcher }: RecentChangesProps) {
  const [entries, setEntries] = useState<ClientActivity[] | null>(null);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again on each new version.
  useEffect(() => {
    let live = true;
    void callPools<{ activity: ClientActivity[] }>(fetcher, `/api/pools/${poolId}/activity`).then(
      (answer) => {
        if (!live) return;
        setFailed(!answer.ok);
        if (answer.ok) setEntries(answer.body.activity ?? []);
      },
    );
    return () => {
      live = false;
    };
  }, [poolId, version, fetcher]);
  if (entries === null) {
    return <Text tone="muted">{failed ? "Recent changes didn't load." : "Loading…"}</Text>;
  }
  const now = new Date();
  return (
    <div className="flex flex-col gap-2 text-sm">
      {failed ? (
        <p className="text-c3">Recent changes didn't load; this is the last list.</p>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-c3">No changes yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="break-words">
              <span className="font-bold text-c1">{entry.username}</span> {entry.summary}{" "}
              <time dateTime={entry.at} className="text-c3 text-xs">
                {activityWhen(entry.at, now)}
              </time>
            </li>
          ))}
        </ol>
      )}
      <LinkRow items={[{ href: `/pools/${poolId}/history`, label: "Full history" }]} />
    </div>
  );
}
