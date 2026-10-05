/**
 * @file src/components/history/RevertButton.tsx
 * @desc Restores a pool to the version shown, after a two-step confirm. On success, goes to the
 *       pool's editor; a refusal shows its message in an always-mounted live Notice.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { InlineConfirm, Notice } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HISTORY_COPY } from "@/constants/history";
import { callPools, type Fetcher } from "@/lib/pool-client";

type RevertButtonProps = {
  poolId: string;
  revisionId: string;
  fetcher?: Fetcher;
};

/**
 * @function RevertButton
 * @param props {RevertButtonProps} the pool and the revision to restore, a fetcher (tests)
 * @returns {JSX.Element} the confirm, and a live error notice when the restore fails
 */
export function RevertButton({ poolId, revisionId, fetcher = fetch }: RevertButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const onConfirm = async () => {
    const answer = await callPools(fetcher, `/api/pools/${poolId}/history/${revisionId}/revert`, {
      method: "POST",
    });
    if (answer.ok) {
      setError("");
      router.push(`/pools/${poolId}/edit`);
      return;
    }
    setError(answer.message);
  };
  return (
    <div className="flex flex-col gap-2">
      <InlineConfirm
        trigger="Restore this version"
        question={HISTORY_COPY.revertQuestion}
        onConfirm={onConfirm}
      />
      <Notice tone="error" live>
        {error}
      </Notice>
    </div>
  );
}
