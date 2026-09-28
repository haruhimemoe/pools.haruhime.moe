/**
 * @file src/components/builder/VisibilityForm.tsx
 * @desc The owner's "Who can see this pool": private, unlisted or public, saved with PUT
 *       /api/pools/<id>/visibility in turn with the editor's other changes. Picking unlisted or
 *       public says packs downloads come later; private needs no note. The result is announced,
 *       with packs' notice when going private couldn't remove the pack there yet.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import {
  PACK_LATER,
  VISIBILITIES,
  VISIBILITY_TEXT,
  type Visibility,
} from "@/constants/built-pools";
import type { PoolEditor } from "@/hooks/usePoolEditor";
import { useStoredField } from "@/hooks/useStoredField";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool } from "@/schemas/built-pool-view";

type VisibilityFormProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt">;
  fetcher?: Fetcher;
};

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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold text-c3 text-sm">Who can see this pool</legend>
        {VISIBILITIES.map((value) => (
          <label key={value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              value={value}
              checked={picked === value}
              onChange={() => setPicked(value)}
              className="mt-1 accent-h1"
            />
            <span>
              <span className="font-bold text-c1">{VISIBILITY_TEXT[value].label}</span>{" "}
              <span className="text-c3">{VISIBILITY_TEXT[value].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {picked !== "private" ? <p className="text-c3 text-sm">{PACK_LATER}</p> : null}
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        disabled={pending || picked === pool.visibility}
      >
        Save who can see it
      </Button>
      <output aria-live="polite" className="text-c2 text-sm">
        {message}
      </output>
    </form>
  );
}
