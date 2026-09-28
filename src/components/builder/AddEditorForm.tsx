/**
 * @file src/components/builder/AddEditorForm.tsx
 * @desc The owner's "Add an editor" by osu! username (POST /api/pools/<id>/editors, in turn with
 *       the editor's changes). osu! is asked for the name, so it can take a moment; a name osu!
 *       doesn't know, a repeat, the owner or an 11th editor is said under the field.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import { MAX_EDITORS } from "@/constants/built-pools";
import type { PoolEditor } from "@/hooks/usePoolEditor";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";

type AddEditorFormProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt">;
  fetcher: Fetcher;
  /** Says who was added. */
  onDone: (message: string) => void;
};

export function AddEditorForm({ pool, editor, fetcher, onDone }: AddEditorFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const full = pool.editors.length >= MAX_EDITORS;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") return;
    setPending(true);
    const answer = await editor.exclusive(() =>
      callPools<{ pool: ClientPool }>(fetcher, `/api/pools/${pool.id}/editors`, {
        method: "POST",
        body: { username: name.trim() },
      }),
    );
    setPending(false);
    if (!answer.ok) {
      setError(answer.message);
      // Back on the field, a screen reader reads the error it describes.
      document.getElementById("add-editor")?.focus();
      return;
    }
    editor.adopt(answer.body.pool);
    setError(null);
    setName("");
    const added = answer.body.pool.editors.at(-1)?.username ?? name.trim();
    onDone(`${added} can edit this pool now.`);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <TextInput
        id="add-editor"
        label="Add an editor"
        hint={
          full
            ? `A pool can have at most ${MAX_EDITORS} editors.`
            : "Their osu! username. They can change the maps and details, not who sees the pool."
        }
        value={name}
        autoComplete="off"
        spellCheck={false}
        disabled={full}
        error={error ?? undefined}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" variant="secondary" className="self-start" disabled={full || pending}>
        {pending ? "Adding…" : "Add editor"}
      </Button>
    </form>
  );
}
