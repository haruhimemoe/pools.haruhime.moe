/**
 * @file src/components/builder/PackPanel.tsx
 * @desc The pool's pack on packs.haruhime.moe, in the editor: where it stands (none for a private
 *       pool, with who can share it; none for an empty one; pending; synced; failed with packs'
 *       reason, and for a refusal that the next change sends it again; or removed by packs'
 *       moderators for good, private or not), a link to it while there's one, and "Update pack
 *       now" for the owner and editors, which syncs without waiting out the 30 s between syncs
 *       (POST /api/pools/<id>/pack, in turn with the editor's changes). The answer's pool is
 *       taken as the new state and announced; a refusal is said.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useState } from "react";
import { PACK_STATUS_TEXT } from "@/constants/built-pools";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";
import type { PoolEditor } from "@/schemas/pool-editor";

type PackPanelProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt">;
  fetcher?: Fetcher;
};

const statusOf = ({ visibility, slots, pack, access }: ClientPool): string => {
  if (pack.gone) return PACK_STATUS_TEXT.gone;
  if (visibility === "private") {
    return access.canManage ? PACK_STATUS_TEXT.private : PACK_STATUS_TEXT.privateEditor;
  }
  if (pack.state === "failed") {
    const failed = `${PACK_STATUS_TEXT.failed} ${pack.error ?? "no reason given."}`;
    return pack.retry ? failed : `${failed} ${PACK_STATUS_TEXT.refused}`;
  }
  if (slots.length === 0 && pack.state === "none") return PACK_STATUS_TEXT.empty;
  if (pack.state === "synced") return PACK_STATUS_TEXT.synced;
  return PACK_STATUS_TEXT.pending;
};

type Note = { text: string; error: boolean };

export function PackPanel({ pool, editor, fetcher = fetch }: PackPanelProps) {
  const [pending, setPending] = useState(false);
  // One live region: a refusal is shown, what came back is only announced (the line above shows it).
  const [note, setNote] = useState<Note>({ text: "", error: false });
  const { pack } = pool;
  const canUpdate = pool.visibility !== "private" && pool.slots.length > 0 && !pack.gone;
  const update = async () => {
    setPending(true);
    setNote({ text: "", error: false });
    const answer = await editor.exclusive(() =>
      callPools<{ pool: ClientPool }>(fetcher, `/api/pools/${pool.id}/pack`, { method: "POST" }),
    );
    if (answer.ok) {
      editor.adopt(answer.body.pool);
      setNote({ text: statusOf(answer.body.pool), error: false });
    } else {
      setNote({ text: answer.message, error: true });
    }
    setPending(false);
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-c2">{statusOf(pool)}</p>
      {pack.href ? (
        <a href={pack.href} rel="noopener" className="font-bold text-h1 underline">
          Open the pack on packs
        </a>
      ) : null}
      {canUpdate ? (
        <Button variant="secondary" className="self-start" disabled={pending} onClick={update}>
          {pending ? "Updating…" : "Update pack now"}
        </Button>
      ) : null}
      <output aria-live="polite" className={note.error ? "font-bold text-rose-300" : "sr-only"}>
        {note.text}
      </output>
    </div>
  );
}
