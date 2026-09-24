/**
 * @file src/components/admin/PoolEditForm.tsx
 * @desc The admin's pool form: tournament, round, year, notes, hidden and badged. Saving sends the
 *       fields to PATCH /api/admin/pools/[id] and says what happened to the pool's pack. Each field
 *       follows its stored value: when a refresh brings a new one (this form's save, or the
 *       tournament-wide badged form on the same page), the field takes it, so a save never sends a
 *       stale value back. Fields whose stored value didn't change keep what the admin typed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button, Checkbox, Select, Textarea, TextInput } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { SyncState } from "@/schemas/pool";

type Fields = {
  tournament: string;
  round: string | null;
  year: number | null;
  notes: string;
  hidden: boolean;
  badged: boolean | null;
};

type Outcome =
  | { status: "not-needed" }
  | { status: "sent"; state: SyncState; error: string | null }
  | { status: "failed"; message: string };

const outcomeText = (sync: Outcome): string => {
  if (sync.status === "not-needed") return "Saved. The pack didn't need an update.";
  if (sync.status === "failed") return `Saved, but the pack wasn't updated: ${sync.message}`;
  if (sync.state === "error")
    return `Saved, but packs didn't take the update: ${sync.error ?? "no answer"} Retry from /admin.`;
  if (sync.state === "rejected") return `Saved, but packs refused the update: ${sync.error ?? ""}`;
  if (sync.state === "gone")
    return "Saved. packs deleted this pool's pack, so it isn't sent any more.";
  return "Saved. packs updated the pack.";
};

const BADGED_VALUES = { unknown: null, yes: true, no: false } as const;

/**
 * A form field's state that follows its stored value. App Router keeps client state across
 * router.refresh(), so without this the field would keep the value it mounted with.
 * @function useStoredField
 * @param stored {T} the field's value as the server has it now
 * @returns {[T, (value: T) => void]} the field's value and its setter
 */
function useStoredField<T>(stored: T): [T, (value: T) => void] {
  const [value, setValue] = useState(stored);
  const [seen, setSeen] = useState(stored);
  if (!Object.is(seen, stored)) {
    setSeen(stored);
    setValue(stored);
  }
  return [value, setValue];
}

export function PoolEditForm({ poolId, initial }: { poolId: string; initial: Fields }) {
  const router = useRouter();
  const [tournament, setTournament] = useStoredField(initial.tournament);
  const [round, setRound] = useStoredField(initial.round ?? "");
  const [year, setYear] = useStoredField(initial.year === null ? "" : String(initial.year));
  const [notes, setNotes] = useStoredField(initial.notes);
  const [hidden, setHidden] = useStoredField(initial.hidden);
  const [badged, setBadged] = useStoredField<keyof typeof BADGED_VALUES>(
    initial.badged === null ? "unknown" : initial.badged ? "yes" : "no",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch(`/api/admin/pools/${poolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournament,
          round: round.trim() === "" ? null : round,
          year: year.trim() === "" ? null : Number(year),
          notes,
          hidden,
          badged: BADGED_VALUES[badged],
        }),
      });
      const body = (await response.json()) as { sync?: Outcome; error?: { message?: string } };
      setMessage(
        response.ok && body.sync
          ? outcomeText(body.sync)
          : (body.error?.message ?? `The save failed (${response.status}).`),
      );
      if (response.ok) router.refresh();
    } catch {
      setMessage("The save didn't reach the server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextInput
        id="edit-tournament"
        label="Tournament"
        value={tournament}
        onChange={(event) => setTournament(event.target.value)}
      />
      <TextInput
        id="edit-round"
        label="Round"
        hint="Empty for none."
        value={round}
        onChange={(event) => setRound(event.target.value)}
      />
      <TextInput
        id="edit-year"
        label="Year"
        hint="Empty when it isn't known."
        inputMode="numeric"
        value={year}
        onChange={(event) => setYear(event.target.value)}
      />
      <Textarea
        id="edit-notes"
        label="Notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Checkbox
        id="edit-hidden"
        label="Hidden"
        hint="Off every public page, and unlisted on packs."
        checked={hidden}
        onChange={(event) => setHidden(event.target.checked)}
      />
      <Select
        id="edit-badged"
        label="Badged tournament"
        value={badged}
        onChange={(event) => setBadged(event.target.value as keyof typeof BADGED_VALUES)}
      >
        <option value="unknown">Not known</option>
        <option value="yes">Badged</option>
        <option value="no">Not badged</option>
      </Select>
      <Button type="submit" className="self-start" disabled={pending}>
        Save
      </Button>
      <output className="text-c2 text-sm" aria-live="polite">
        {message}
      </output>
    </form>
  );
}
