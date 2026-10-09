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
 *       pool keeps that pool's targets instead. Opened as /new#<pack key> (a draft from harumin's /pool fromtop), it
 *       fills in the draft's name, says its maps come along and sends draftKey; a key kept
 *       before sign-in counts too, and one that doesn't read is said over the plain form.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Thu Oct 8, 2026
 */

"use client";

import { Button, Select, Text, TextInput } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { POOL_TEMPLATES, type TemplateId } from "@/constants/targets";
import { callPools, type Fetcher } from "@/lib/pool-client";
import { builtDetailsFields } from "@/schemas/built-pool";
import type { StartFrom } from "@/schemas/built-pool-view";
import { templateLabel } from "@/utils/bucket-targets";
import { type Draft, draftFromHash, takeDraftHash } from "@/utils/draft-key";

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

/**
 * @function NewPoolForm
 * @param props {NewPoolFormProps} the pool to start from and a fetcher (tests)
 * @returns {JSX.Element} the new pool's details and template, sent to POST /api/pools, then the
 *          editor
 */
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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [badDraft, setBadDraft] = useState(false);
  useEffect(() => {
    if (startFrom) return;
    const raw = takeDraftHash();
    if (!raw) return;
    const read = draftFromHash(raw);
    if (!read) {
      setBadDraft(true);
      return;
    }
    setDraft(read);
    setValues((was) => (was.name ? was : { ...was, name: read.name }));
  }, [startFrom]);
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
    else if (draft) body.draftKey = draft.key;
    if (!startFrom && template !== "blank") body.template = template;
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
      {draft ? (
        <p className="text-c2 text-sm">
          It starts with the {draft.slots.length === 1 ? "1 map" : `${draft.slots.length} maps`} of
          the draft.
        </p>
      ) : null}
      {badDraft ? (
        <Text role="status" tone="error">
          That draft link didn't open.
        </Text>
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
      <Button type="submit" disabled={pending}>
        {pending ? "Making it…" : "Make the pool"}
      </Button>
      {failure ? (
        <Text role="alert" tone="error" bold>
          {failure}
        </Text>
      ) : null}
    </form>
  );
}
