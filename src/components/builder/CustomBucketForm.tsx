/**
 * @file src/components/builder/CustomBucketForm.tsx
 * @desc Adds a custom bucket (slot code) to the pool: its code, and what its maps are played
 *       with (no mods, forced mods picked as chips, or freemod). The code and the mod set are
 *       checked with @haruhimemoe/pool's own rules before anything is sent; a problem is said
 *       under its field. An empty custom bucket is removed from its own section.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import {
  BUCKET_CODE_MESSAGES,
  checkBucketCode,
  MOD_ACRONYMS,
  MOD_SET_MESSAGES,
  type ModAcronym,
  modSetProblem,
} from "@haruhimemoe/pool";
import { hasBlockedLanguage } from "@haruhimemoe/pool/content-filter";
import { Button, ChipGroup, Select, Text, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { ClientPool } from "@/schemas/built-pool-view";

type Kind = "none" | "forced" | "free";

const MOD_OPTIONS = MOD_ACRONYMS.map((mod) => ({ value: mod, label: mod }));

type CustomBucketFormProps = { pool: ClientPool; change: (ops: PoolOp[]) => boolean };

/**
 * @function CustomBucketForm
 * @param props {CustomBucketFormProps} the pool and the change call
 * @returns {JSX.Element} the form that adds a custom slot with forced mods or freemod
 */
export function CustomBucketForm({ pool, change }: CustomBucketFormProps) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<Kind>("forced");
  const [set, setSet] = useState<ModAcronym[]>([]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [modsError, setModsError] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = code.trim();
    const problem = checkBucketCode(pool.buckets, trimmed);
    const codeProblem = problem
      ? BUCKET_CODE_MESSAGES[problem]
      : hasBlockedLanguage(trimmed)
        ? "That fails the content filter."
        : null;
    const setProblem = kind === "forced" ? modSetProblem(set) : null;
    setCodeError(codeProblem);
    setModsError(setProblem ? MOD_SET_MESSAGES[setProblem] : null);
    if (codeProblem) document.getElementById("bucket-code")?.focus();
    if (codeProblem || setProblem) return;
    const mods = kind === "forced" ? { kind, set } : { kind };
    if (change([{ type: "addBucket", code: trimmed, mods }])) {
      setCode("");
      setSet([]);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          id="bucket-code"
          label="Slot code"
          hint="1 to 12 letters and digits, like EX or HDHR."
          value={code}
          autoComplete="off"
          error={codeError ?? undefined}
          onChange={(event) => setCode(event.target.value)}
        />
        <Select
          id="bucket-kind"
          label="Played with"
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
        >
          <option value="forced">Forced mods</option>
          <option value="free">Freemod</option>
          <option value="none">No mods</option>
        </Select>
      </div>
      {kind === "forced" ? (
        <div className="flex flex-col gap-1">
          <ChipGroup
            label="Forced mods"
            options={MOD_OPTIONS}
            value={set}
            onChange={(next) => setSet(next as ModAcronym[])}
          />
          {modsError ? (
            <Text role="alert" tone="error">
              {modsError}
            </Text>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" variant="secondary">
        Add slot
      </Button>
    </form>
  );
}
