/**
 * @file src/components/admin/RetrySyncButtons.tsx
 * @desc The two retry buttons: failed syncs, and failed plus rejected ones. Each click sends up to
 *       50 pools and says what was sent and what's left, or why nothing was.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
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

export function RetrySyncButtons() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const retry = async (includeRejected: boolean) => {
    setPending(true);
    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeRejected }),
      });
      setMessage(
        response.ok
          ? summaryText((await response.json()) as SyncSummary)
          : `The retry failed (${response.status}).`,
      );
      router.refresh();
    } catch {
      setMessage("The retry didn't reach the server.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => retry(false)} disabled={pending}>
          Retry failed syncs
        </Button>
        <Button variant="secondary" onClick={() => retry(true)} disabled={pending}>
          Retry failed and rejected
        </Button>
      </div>
      <output className="text-c2 text-sm" aria-live="polite">
        {message}
      </output>
    </div>
  );
}
