/**
 * @file src/components/admin/RetryPackCleanupButton.tsx
 * @desc "Retry pack cleanup" on /admin: tries every pack removal waiting in pack_cleanup (up to
 *       50 a click) and says what was removed, kept and still failing, or why nothing was tried.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { AsyncButton } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { cleanupSummaryText, type PackCleanupSummary } from "@/utils/pack-cleanup";

/**
 * @function RetryPackCleanupButton
 * @returns {JSX.Element} "Retry pack cleanup" (ui's AsyncButton): one run over the queue, what it
 *          did said beside it, then the page refreshes
 */
export function RetryPackCleanupButton() {
  const router = useRouter();
  const retry = async (): Promise<string> => {
    const response = await fetch("/api/admin/pack-cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const said = response.ok
      ? cleanupSummaryText((await response.json()) as PackCleanupSummary)
      : `The retry failed (${response.status}).`;
    router.refresh();
    return said;
  };
  return (
    <AsyncButton
      variant="secondary"
      action={retry}
      pendingLabel="Retrying…"
      failedMessage="The retry didn't reach the server."
      wrapperClassName="flex-col items-start gap-2"
    >
      Retry pack cleanup
    </AsyncButton>
  );
}
