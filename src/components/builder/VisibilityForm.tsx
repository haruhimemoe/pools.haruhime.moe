/**
 * @file src/components/builder/VisibilityForm.tsx
 * @desc The owner's "Who can see this pool": private, unlisted or public, saved with PUT
 *       /api/pools/<id>/visibility in turn with the editor's other changes. Picking unlisted or
 *       public says it gets a pack on packs; private needs no note. The result is announced,
 *       with packs' notice when going private couldn't remove the pack there yet.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { Button, Text, VisibilitySelect } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import { PACK_NOTE, VISIBILITY_TEXT, type Visibility } from "@/constants/built-pools";
import { useStoredField } from "@/hooks/useStoredField";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";
import type { PoolEditor } from "@/schemas/pool-editor";

type VisibilityFormProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt">;
  fetcher?: Fetcher;
};

/**
 * @function VisibilityForm
 * @param props {VisibilityFormProps} the pool, the editor's exclusive and adopt, a fetcher (tests)
 * @returns {JSX.Element} the owner's private, unlisted or public picker, saved on its own
 */
export function VisibilityForm({ pool, editor, fetcher = fetch }: VisibilityFormProps) {
  const [picked, setPicked] = useStoredField<Visibility>(pool.visibility);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const answer = await editor.exclusive(() =>
      callPools<{ pool: ClientPool; notice?: string }>(
        fetcher,
        `/api/pools/${pool.id}/visibility`,
        { method: "PUT", body: { visibility: picked } },
      ),
    );
    if (answer.ok) editor.adopt(answer.body.pool);
    const saved = `Saved: ${VISIBILITY_TEXT[picked].label.toLowerCase()}.`;
    const notice = answer.ok && answer.body.notice ? ` ${answer.body.notice}` : "";
    setMessage(answer.ok ? `${saved}${notice}` : answer.message);
    setPending(false);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <VisibilitySelect
        label="Who can see this pool"
        id="visibility"
        text={VISIBILITY_TEXT}
        value={picked}
        onChange={setPicked}
      />
      {picked !== "private" ? <Text tone="muted">{PACK_NOTE}</Text> : null}
      <Button type="submit" variant="secondary" disabled={pending || picked === pool.visibility}>
        Save who can see it
      </Button>
      <output aria-live="polite" className="text-c2 text-sm">
        {message}
      </output>
    </form>
  );
}
