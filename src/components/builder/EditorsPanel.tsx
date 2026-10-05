/**
 * @file src/components/builder/EditorsPanel.tsx
 * @desc Who edits the pool: the owner and each editor, linking their osu! profiles. The owner
 *       adds an editor by osu! username (someone who never signed in gets access when they do),
 *       the owner's Remove asks first (ui's InlineConfirm); an editor can leave. Requests take
 *       turns with the editor's changes; a removal answers without the pool, so the pool is read
 *       again after it. Results are announced.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { userUrl } from "@haruhimemoe/osu/shapes";
import { Button, InlineConfirm, TextLink } from "@haruhimemoe/ui";
import { useRef, useState } from "react";
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
  const said = useRef<HTMLOutputElement>(null);
  const remove = async (person: PoolPerson): Promise<boolean> => {
    setPending(true);
    const self = person.osuId === me;
    const answer = await editor.exclusive(async () => {
      const path = `/api/pools/${pool.id}/editors/${person.osuId}`;
      const done = await callPools<null>(fetcher, path, { method: "DELETE" });
      if (done.ok && !self) await editor.reload(true);
      return done;
    });
    setPending(false);
    if (answer.ok && self) {
      onLeft();
      return true;
    }
    setMessage(answer.ok ? `${person.username} no longer edits this pool.` : answer.message);
    // Their row (and the confirm in it) is gone: focus goes to what was said.
    if (answer.ok) said.current?.focus();
    return answer.ok;
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
              <InlineConfirm
                trigger="Remove"
                triggerProps={{
                  variant: "ghost",
                  disabled: pending,
                  "aria-label": `Remove ${person.username} as an editor`,
                }}
                question={`Remove ${person.username} as an editor?`}
                confirmLabel="Remove"
                confirmVariant="danger"
                pendingLabel="Removing…"
                onConfirm={async () => {
                  // Throwing keeps the confirm open; the reason shows below the list.
                  if (!(await remove(person))) throw new Error("not removed");
                }}
              />
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
          onClick={() => {
            remove({ osuId: me, username: "you" });
          }}
        >
          Leave this pool
        </Button>
      ) : null}
      <output ref={said} tabIndex={-1} aria-live="polite" className="text-c2 outline-none">
        {message}
      </output>
    </div>
  );
}
