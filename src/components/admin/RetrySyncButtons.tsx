/**
 * @file src/components/admin/RetrySyncButtons.tsx
 * @desc The two retry buttons: failed syncs, and failed plus rejected ones. Each click sends up to
 *       50 pools and says what was sent and what's left, or why nothing was. One runs at a time:
 *       while one runs the other is off, so two runs never send the same pools twice.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { AsyncButton } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SYNC_STATES } from "@/schemas/pool";
import type { SyncSummary } from "@/utils/sync";

const summaryText = (summary: SyncSummary): string => {
  if (summary.configError) return `Nothing sent: ${summary.configError}`;
  if (summary.due === 0) return "Nothing to retry.";
  const answers = SYNC_STATES.filter((state) => summary.states[state] > 0)
    .map((state) => `${summary.states[state]} ${state}`)
    .join(", ");
  const left = summary.remaining > 0 ? ` ${summary.remaining} still due.` : "";
  return `Sent ${summary.sent}: ${answers}.${left}`;
};

/**
 * @function RetrySyncButtons
 * @returns {JSX.Element} "Retry failed syncs" and "Retry failed and rejected" (ui's AsyncButton
 *          each, the other one off while one runs), what each run sent said beside it, then the
 *          page refreshes
 */
export function RetrySyncButtons() {
  const router = useRouter();
  // Which retry is running (the one with rejected pools, or not), so the other stays off.
  const [running, setRunning] = useState<boolean | null>(null);
  const retry = (includeRejected: boolean) => async (): Promise<string> => {
    setRunning(includeRejected);
    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeRejected }),
      });
      const said = response.ok
        ? summaryText((await response.json()) as SyncSummary)
        : `The retry failed (${response.status}).`;
      router.refresh();
      return said;
    } finally {
      setRunning(null);
    }
  };
  const failed = "The retry didn't reach the server.";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <AsyncButton
        action={retry(false)}
        disabled={running === true}
        pendingLabel="Retrying…"
        failedMessage={failed}
      >
        Retry failed syncs
      </AsyncButton>
      <AsyncButton
        variant="secondary"
        action={retry(true)}
        disabled={running === false}
        pendingLabel="Retrying…"
        failedMessage={failed}
      >
        Retry failed and rejected
      </AsyncButton>
    </div>
  );
}
