/**
 * @file src/components/admin/RetryPackCleanupButton.tsx
 * @desc "Retry pack cleanup" on /admin: tries every pack removal waiting in pack_cleanup (up to
 *       50 a click) and says what was removed, kept and still failing, or why nothing was tried.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cleanupSummaryText, type PackCleanupSummary } from "@/utils/pack-cleanup";

export function RetryPackCleanupButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const retry = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/admin/pack-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setMessage(
        response.ok
          ? cleanupSummaryText((await response.json()) as PackCleanupSummary)
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
      <Button variant="secondary" className="self-start" onClick={retry} disabled={pending}>
        Retry pack cleanup
      </Button>
      <output className="text-c2 text-sm" aria-live="polite">
        {message}
      </output>
    </div>
  );
}
