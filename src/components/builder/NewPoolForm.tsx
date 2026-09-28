/**
 * @file src/components/builder/NewPoolForm.tsx
 * @desc "Make a pool" on /new: a name, and optionally the tournament, round and year, checked
 *       with the server's own schemas. POST /api/pools makes it (private and empty) and the
 *       browser goes on to its editor. A refusal (50 pools already, too many new pools this
 *       hour) or no answer is said in the page. Started from a pool (/new?from=<id>), the form
 *       comes filled in with its details, says how many maps come with it, and sends
 *       startedFrom, so the new pool copies its maps and buckets. Every detail is sent, an
 *       empty one as "" (a null year), so one cleared from the source pool stays cleared. A new
 *       pool can take a template (its slot counts as targets, never maps); one started from a
 *       pool keeps that pool's targets instead.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button, Select, TextInput } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { POOL_TEMPLATES, type TemplateId } from "@/constants/targets";
import { callPools, type Fetcher } from "@/lib/pool-client";
import { builtDetailsFields } from "@/schemas/built-pool";
import type { StartFrom } from "@/schemas/built-pool-view";
import { templateLabel } from "@/utils/bucket-targets";

type Field = "name" | "tournament" | "round" | "year";

const FIELDS: readonly { key: Field; label: string; hint?: string }[] = [
  { key: "name", label: "Name", hint: "Like Spring Cup 2026 Qualifiers. You can change it later." },
  { key: "tournament", label: "Tournament", hint: "Optional." },
  { key: "round", label: "Round", hint: "Optional." },
  { key: "year", label: "Year", hint: "Optional." },
];

const readYear = (text: string) =>
  /^\d+$/.test(text) ? builtDetailsFields.year.safeParse(Number(text)) : null;

type NewPoolFormProps = { startFrom?: StartFrom; fetcher?: Fetcher };

export function NewPoolForm({ startFrom, fetcher = fetch }: NewPoolFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>({
    name: startFrom?.name ?? "",
    tournament: startFrom?.tournament ?? "",
    round: startFrom?.round ?? "",
    year: startFrom?.year === null || !startFrom ? "" : String(startFrom.year),
  });
  const [template, setTemplate] = useState<TemplateId>("blank");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body: Record<string, unknown> = {};
    const found: Partial<Record<Field, string>> = {};
    for (const { key } of FIELDS) {
      const text = values[key].trim();
      // An empty detail goes as empty: the server would otherwise take the source pool's.
      if (key !== "name" && text === "") {
        body[key] = key === "year" ? null : "";
        continue;
      }
      const parsed =
        key === "year" ? readYear(text) : builtDetailsFields[key].safeParse(values[key]);
      if (parsed?.success) body[key] = parsed.data;
      else found[key] = parsed?.error.issues[0]?.message ?? "A year is a whole number.";
    }
    setErrors(found);
    const first = FIELDS.find(({ key }) => found[key]);
    if (first) {
      document.getElementById(`new-${first.key}`)?.focus();
      return;
    }
    if (startFrom) body.startedFrom = startFrom.id;
    else if (template !== "blank") body.template = template;
    setPending(true);
    setFailure(null);
    const answer = await callPools<{ id: string }>(fetcher, "/api/pools", { method: "POST", body });
    if (answer.ok) {
      router.push(`/pools/${answer.body.id}/edit`);
      return;
    }
    setFailure(answer.message);
    setPending(false);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {startFrom ? (
        <p className="text-c2 text-sm">
          It starts with the {startFrom.maps === 1 ? "1 map" : `${startFrom.maps} maps`} of{" "}
          {startFrom.name}.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, hint }) => (
          <TextInput
            key={key}
            id={`new-${key}`}
            label={label}
            hint={hint}
            value={values[key]}
            autoComplete="off"
            inputMode={key === "year" ? "numeric" : undefined}
            error={errors[key]}
            onChange={(event) => setValues((was) => ({ ...was, [key]: event.target.value }))}
          />
        ))}
      </div>
      {startFrom ? null : (
        <Select
          id="new-template"
          label="Template"
          hint="Sets how many maps each slot should hold. It adds no maps, and you can change the counts."
          value={template}
          onChange={(event) => setTemplate(event.target.value as TemplateId)}
        >
          {POOL_TEMPLATES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {templateLabel(entry)}
            </option>
          ))}
        </Select>
      )}
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Making it…" : "Make the pool"}
      </Button>
      {failure ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {failure}
        </p>
      ) : null}
    </form>
  );
}
