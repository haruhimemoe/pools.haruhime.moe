/**
 * @file src/components/builder/PackPanel.tsx
 * @desc The pool's pack on packs.haruhime.moe, in the editor: where it stands (none for a private
 *       or empty pool, pending, synced with a link to it, failed with packs' reason, or removed
 *       by packs' moderators for good) and "Update pack now" for the owner and editors, which
 *       syncs without waiting out the 30 s between syncs (POST /api/pools/<id>/pack, in turn with
 *       the editor's changes). The answer's pool is taken as the new state; a refusal is said.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useState } from "react";
import { PACK_STATUS_TEXT } from "@/constants/built-pools";
import type { PoolEditor } from "@/hooks/usePoolEditor";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";

type PackPanelProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt">;
  fetcher?: Fetcher;
};

const statusOf = ({ visibility, slots, pack }: ClientPool): string => {
  if (visibility === "private") return PACK_STATUS_TEXT.private;
  if (pack.state === "failed")
    return `${PACK_STATUS_TEXT.failed} ${pack.error ?? "no reason given."}`;
  if (slots.length === 0 && pack.state === "none") return PACK_STATUS_TEXT.empty;
  if (pack.state === "synced") return PACK_STATUS_TEXT.synced;
  return PACK_STATUS_TEXT.pending;
};

export function PackPanel({ pool, editor, fetcher = fetch }: PackPanelProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const { pack } = pool;
  const canUpdate = pool.visibility !== "private" && pool.slots.length > 0 && !pack.gone;
  const update = async () => {
    setPending(true);
    setMessage("");
    const answer = await editor.exclusive(() =>
      callPools<{ pool: ClientPool }>(fetcher, `/api/pools/${pool.id}/pack`, { method: "POST" }),
    );
    if (answer.ok) editor.adopt(answer.body.pool);
    else setMessage(answer.message);
    setPending(false);
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-c2">{statusOf(pool)}</p>
      {pack.state === "synced" && pack.href ? (
        <a href={pack.href} rel="noopener" className="font-bold text-h1 underline">
          Open the pack on packs
        </a>
      ) : null}
      {canUpdate ? (
        <Button variant="secondary" className="self-start" disabled={pending} onClick={update}>
          {pending ? "Updating…" : "Update pack now"}
        </Button>
      ) : null}
      <output aria-live="polite" className="font-bold text-rose-300">
        {message}
      </output>
    </div>
  );
}
