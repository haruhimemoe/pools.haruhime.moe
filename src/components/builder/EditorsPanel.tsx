/**
 * @file src/components/builder/EditorsPanel.tsx
 * @desc Who edits the pool: the owner and each editor, linking their osu! profiles. The owner
 *       adds an editor by osu! username (someone who never signed in gets access when they do)
 *       and removes one; an editor can leave. Requests take turns with the editor's changes; a
 *       removal answers without the pool, so the pool is read again after it. Results are
 *       announced.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { userUrl } from "@haruhimemoe/osu/shapes";
import { Button, TextLink } from "@haruhimemoe/ui";
import { useState } from "react";
import { AddEditorForm } from "@/components/builder/AddEditorForm";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { ClientPool, PoolPerson } from "@/schemas/built-pool-view";
import type { PoolEditor } from "@/schemas/pool-editor";

type EditorsPanelProps = {
  pool: ClientPool;
  editor: Pick<PoolEditor, "exclusive" | "adopt" | "reload">;
  /** The signed-in user's osu! id. */
  me: number;
  /** After the signed-in editor leaves the pool. */
  onLeft: () => void;
  fetcher?: Fetcher;
};

function Person({ person }: { person: PoolPerson }) {
  return (
    <TextLink href={userUrl(person.osuId)} rel="noopener" variant="plain">
      {person.username}
    </TextLink>
  );
}

/**
 * @function EditorsPanel
 * @param props {EditorsPanelProps} the pool, the editor, who's looking, what to do on leaving, and
 *        a fetcher (tests)
 * @returns {JSX.Element} the editors list with Remove (owner) or Leave (an editor)
 */
export function EditorsPanel({ pool, editor, me, onLeft, fetcher = fetch }: EditorsPanelProps) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const remove = async (person: PoolPerson) => {
    setPending(true);
    const self = person.osuId === me;
    const answer = await editor.exclusive(async () => {
      const path = `/api/pools/${pool.id}/editors/${person.osuId}`;
      const done = await callPools<null>(fetcher, path, { method: "DELETE" });
      if (done.ok && !self) await editor.reload(true);
      return done;
    });
    setPending(false);
    if (answer.ok && self) onLeft();
    else setMessage(answer.ok ? `${person.username} no longer edits this pool.` : answer.message);
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <ul className="flex flex-col gap-2">
        {pool.owner ? (
          <li>
            <Person person={pool.owner} /> <span className="text-c3">owner</span>
          </li>
        ) : null}
        {pool.editors.map((person) => (
          <li key={person.osuId} className="flex flex-wrap items-center gap-2">
            <Person person={person} /> <span className="text-c3">editor</span>
            {pool.access.canManage ? (
              <Button
                variant="ghost"
                disabled={pending}
                aria-label={`Remove ${person.username} as an editor`}
                onClick={() => remove(person)}
              >
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {pool.editors.length === 0 ? <p className="text-c3">No editors yet.</p> : null}
      {pool.access.canManage ? (
        <AddEditorForm pool={pool} editor={editor} fetcher={fetcher} onDone={setMessage} />
      ) : null}
      {pool.access.isEditor ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => remove({ osuId: me, username: "you" })}
        >
          Leave this pool
        </Button>
      ) : null}
      <output aria-live="polite" className="text-c2">
        {message}
      </output>
    </div>
  );
}
