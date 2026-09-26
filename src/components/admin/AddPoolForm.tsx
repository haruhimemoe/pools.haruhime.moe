/**
 * @file src/components/admin/AddPoolForm.tsx
 * @desc The admin's add-a-pool form: who sent it (the tournament's hosts or a community member),
 *       the name to credit and an optional link, tournament, round, year, badged, notes and the
 *       maps (a packs link, a pack key, or slot lines and IDs). Saving sends JSON to POST
 *       /api/admin/pools, then links the pool it created or the one the maps joined, with what
 *       happened to the pack; a refused save puts each error beside its field.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

"use client";

import { Button, Select, Textarea, TextInput } from "@haruhimemoe/ui";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import type { SyncState } from "@/schemas/pool";

type Sync =
  | { status: "not-needed" }
  | { status: "sent"; state: SyncState; error: string | null }
  | { status: "failed"; message: string };

type Answer = {
  outcome: "created" | "merged";
  revived: boolean;
  pool: { id: string; name: string; href: string };
  sync: Sync;
};

type Refusal = { error?: { message?: string; fields?: Record<string, string> } };

const BADGED_VALUES = { unknown: null, yes: true, no: false } as const;

const syncText = (sync: Sync): string => {
  if (sync.status === "not-needed") return "Its pack didn't need an update.";
  if (sync.status === "failed") return `The pack wasn't sent: ${sync.message}`;
  if (sync.state === "error") return `packs didn't take the pack: ${sync.error ?? "no answer"}`;
  if (sync.state === "rejected") return `packs refused the pack: ${sync.error ?? ""}`;
  return sync.state === "created" ? "packs made its pack." : "packs updated its pack.";
};

/**
 * What happened, after the pool's name (which the form links).
 * @function outcomeText
 * @param answer {Answer} the route's answer
 * @returns {{ before: string; after: string }} the text around the pool's link
 */
const outcomeText = (answer: Answer): { before: string; after: string } => {
  if (answer.outcome === "created")
    return { before: "Added ", after: `. ${syncText(answer.sync)}` };
  const back = answer.revived ? " and it's back from superseded" : "";
  return {
    before: "These maps are already ",
    after: `, so the source joined it${back}. Its name, round, year and notes stay as they were: edit them there. ${syncText(answer.sync)}`,
  };
};

export function AddPoolForm() {
  const [kind, setKind] = useState<"host" | "community">("host");
  const [creditName, setCreditName] = useState("");
  const [creditUrl, setCreditUrl] = useState("");
  const [tournament, setTournament] = useState("");
  const [round, setRound] = useState("");
  const [year, setYear] = useState("");
  const [badged, setBadged] = useState<keyof typeof BADGED_VALUES>("unknown");
  const [notes, setNotes] = useState("");
  const [maps, setMaps] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setAnswer(null);
    try {
      const response = await fetch("/api/admin/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          creditName,
          creditUrl,
          tournament,
          round: round.trim() === "" ? null : round,
          year: year.trim() === "" ? null : Number(year),
          badged: BADGED_VALUES[badged],
          notes,
          maps,
        }),
      });
      const body = (await response.json()) as Answer & Refusal;
      if (response.ok) {
        setErrors({});
        setAnswer(body);
        setMessage("");
      } else {
        const fields = body.error?.fields ?? {};
        setErrors(fields);
        setMessage(
          Object.keys(fields).length > 0
            ? "Fix the fields marked above."
            : (body.error?.message ?? `The pool wasn't added (${response.status}).`),
        );
      }
    } catch {
      setMessage("The pool wasn't added: the request didn't reach the server.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Select
        id="add-kind"
        label="Sent by"
        value={kind}
        error={errors.kind}
        onChange={(event) => setKind(event.target.value as "host" | "community")}
      >
        <option value="host">The tournament's hosts</option>
        <option value="community">A community member</option>
      </Select>
      <TextInput
        id="add-credit-name"
        label="Name to credit"
        hint="The hosts or the sender, as the pool page should name them. Use community submission when the sender would rather not be named."
        value={creditName}
        error={errors.creditName}
        onChange={(event) => setCreditName(event.target.value)}
      />
      <TextInput
        id="add-credit-url"
        label="Credit link"
        hint="Optional, https only: the forum post, sheet or site they gave."
        inputMode="url"
        value={creditUrl}
        error={errors.creditUrl}
        onChange={(event) => setCreditUrl(event.target.value)}
      />
      <TextInput
        id="add-tournament"
        label="Tournament"
        value={tournament}
        error={errors.tournament}
        onChange={(event) => setTournament(event.target.value)}
      />
      <TextInput
        id="add-round"
        label="Round"
        hint="Empty for none."
        value={round}
        error={errors.round}
        onChange={(event) => setRound(event.target.value)}
      />
      <TextInput
        id="add-year"
        label="Year"
        hint="Empty when it isn't known."
        inputMode="numeric"
        value={year}
        error={errors.year}
        onChange={(event) => setYear(event.target.value)}
      />
      <Select
        id="add-badged"
        label="Badged tournament"
        value={badged}
        error={errors.badged}
        onChange={(event) => setBadged(event.target.value as keyof typeof BADGED_VALUES)}
      >
        <option value="unknown">Not known</option>
        <option value="yes">Badged</option>
        <option value="no">Not badged</option>
      </Select>
      <Textarea
        id="add-notes"
        label="Notes"
        value={notes}
        error={errors.notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Textarea
        id="add-maps"
        label="Maps"
        hint="A packs link or pack key, or one map per line with its slot (NM1 129891, HD1 https://osu.ppy.sh/b/75), or bare beatmap IDs. A pack's /p/ link doesn't work: use its key or /k link."
        rows={8}
        value={maps}
        error={errors.maps ?? errors.form}
        onChange={(event) => setMaps(event.target.value)}
      />
      <Button type="submit" className="self-start" disabled={pending}>
        Add pool
      </Button>
      <output className="text-c2 text-sm" aria-live="polite">
        {answer ? (
          <>
            {outcomeText(answer).before}
            <Link href={answer.pool.href} className="font-bold text-h1 hover:underline">
              {answer.pool.name}
            </Link>
            {outcomeText(answer).after}
          </>
        ) : (
          message
        )}
      </output>
    </form>
  );
}
