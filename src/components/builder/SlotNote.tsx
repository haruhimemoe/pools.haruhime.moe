/**
 * @file src/components/builder/SlotNote.tsx
 * @desc A slot's note in the editor: the note under its map, and "Add note" or "Edit note",
 *       which opens a one-line field (Enter or Save sends it, Escape or Cancel leaves it as it
 *       was, and focus goes back to the button). The note is checked with the server's own
 *       schema first; a problem is said under the field and nothing is sent. An empty note
 *       clears it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { MAX_SLOT_NOTE_LENGTH } from "@/constants/targets";
import { slotNoteSchema } from "@/schemas/built-plan";

type SlotNoteProps = {
  beatmapId: number;
  /** The slot's label ("NM1"), for the controls' names. */
  label: string;
  note: string | undefined;
  onSave: (note: string) => void;
};

export function SlotNote({ beatmapId, label, note, onSave }: SlotNoteProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const returning = useRef(false);
  useEffect(() => {
    if (!editing && returning.current) {
      returning.current = false;
      toggle.current?.focus();
    }
  }, [editing]);
  const close = () => {
    returning.current = true;
    setError(null);
    setEditing(false);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = slotNoteSchema.safeParse(text);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "That note can't be saved.");
      return;
    }
    if (parsed.data !== (note ?? "")) onSave(parsed.data);
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") close();
  };
  if (editing) {
    return (
      <form
        onSubmit={submit}
        onKeyDown={onKeyDown}
        className="flex w-full flex-col gap-2"
        noValidate
      >
        <TextInput
          id={`note-${beatmapId}`}
          label={`Note for ${label}`}
          hint={`Up to ${MAX_SLOT_NOTE_LENGTH} characters, like "jump aim check".`}
          autoComplete="off"
          // biome-ignore lint/a11y/noAutofocus: opened by its own button, which it replaces.
          autoFocus
          value={text}
          error={error ?? undefined}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" aria-label={`Save note for ${label}`}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      {note ? <p className="break-words text-c2 text-sm">{note}</p> : null}
      <Button
        ref={toggle}
        variant="ghost"
        aria-label={note ? `Edit note for ${label}` : `Add note to ${label}`}
        onClick={() => {
          setText(note ?? "");
          setEditing(true);
        }}
      >
        {note ? "Edit note" : "Add note"}
      </Button>
    </div>
  );
}
