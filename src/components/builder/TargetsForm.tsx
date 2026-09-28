/**
 * @file src/components/builder/TargetsForm.tsx
 * @desc Sets a bucket's target: pick the slot, then how many maps it should hold (0 to 16) and
 *       an optional star range under its mods. Picking a slot fills in its target; Save sends
 *       setTarget, and a count of 0 with no range clears it. The text is checked first
 *       (src/utils/bucket-targets.ts); a problem is said under its field and nothing is sent.
 *       Lists the targets the pool has.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { bucketOptionLabel } from "@haruhimemoe/pool";
import { Button, Select, TextInput } from "@haruhimemoe/ui";
import { type FormEvent, useState } from "react";
import { MAX_TARGET_COUNT } from "@/constants/targets";
import type { BucketTarget } from "@/schemas/built-plan";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { ClientPool } from "@/schemas/built-pool-view";
import { readTargetInput, type TargetInput, targetText } from "@/utils/bucket-targets";

type TargetsFormProps = { pool: ClientPool; change: (ops: PoolOp[]) => boolean };

const inputOf = (target: BucketTarget | undefined): TargetInput => ({
  count: target && target.count > 0 ? String(target.count) : "",
  min: target?.sr ? String(target.sr.min) : "",
  max: target?.sr ? String(target.sr.max) : "",
});

export function TargetsForm({ pool, change }: TargetsFormProps) {
  const [picked, setCode] = useState(pool.buckets[0]?.code ?? "NM");
  // A custom slot removed meanwhile falls back to the first one.
  const code = pool.buckets.some((entry) => entry.code === picked)
    ? picked
    : (pool.buckets[0]?.code ?? "NM");
  const [input, setInput] = useState<TargetInput>(() => inputOf(pool.targets[code]));
  const [errors, setErrors] = useState<{ count?: string; range?: string }>({});
  const set = (key: keyof TargetInput) => (value: string) =>
    setInput((was) => ({ ...was, [key]: value }));
  const pick = (next: string) => {
    setCode(next);
    setInput(inputOf(pool.targets[next]));
    setErrors({});
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const read = readTargetInput(input);
    if (!read.ok) {
      setErrors({ [read.field]: read.message });
      document.getElementById(read.field === "count" ? "target-count" : "target-min")?.focus();
      return;
    }
    setErrors({});
    const { ok: _, ...target } = read;
    change([{ type: "setTarget", bucket: code, ...target }]);
  };
  const listed = pool.buckets.flatMap((entry) => {
    const target = pool.targets[entry.code];
    return target ? [`${entry.code}: ${targetText(target)}`] : [];
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <p className="text-c3 text-sm">
        How many maps each slot should hold, and the star range they should sit in (under the slot's
        mods). The maps pane shows the gaps.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select id="target-slot" label="Slot" value={code} onChange={(e) => pick(e.target.value)}>
          {pool.buckets.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {bucketOptionLabel(entry)}
            </option>
          ))}
        </Select>
        <TextInput
          id="target-count"
          label="Maps"
          hint={`0 to ${MAX_TARGET_COUNT}.`}
          inputMode="numeric"
          autoComplete="off"
          value={input.count}
          error={errors.count}
          onChange={(event) => set("count")(event.target.value)}
        />
        <TextInput
          id="target-min"
          label="Lowest stars"
          hint="Optional, like 5.8."
          inputMode="decimal"
          autoComplete="off"
          value={input.min}
          error={errors.range}
          onChange={(event) => set("min")(event.target.value)}
        />
        <TextInput
          id="target-max"
          label="Highest stars"
          hint="Optional, like 6.3."
          inputMode="decimal"
          autoComplete="off"
          value={input.max}
          onChange={(event) => set("max")(event.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary" className="self-start">
        Save target
      </Button>
      {listed.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {listed.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
