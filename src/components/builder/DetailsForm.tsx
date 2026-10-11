/**
 * @file src/components/builder/DetailsForm.tsx
 * @desc The pool's name, tournament, round, year and notes, each edited in place and saved on
 *       its own as a setDetails change. Values are checked with the server's own schemas
 *       (src/schemas/built-pool.ts), so what the editor shows is what gets saved.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { useTranslations } from "next-intl";
import type { z } from "zod";
import { DetailField, type FieldCheck } from "@/components/builder/DetailField";
import { builtDetailsFields } from "@/schemas/built-pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { ClientPool } from "@/schemas/built-pool-view";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

type DetailKey = keyof typeof builtDetailsFields;

const checkWith =
  (t: T, schema: z.ZodType) =>
  (input: unknown): FieldCheck => {
    const parsed = schema.safeParse(input);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, message: parsed.error.issues[0]?.message ?? t("invalid") };
  };

const checkYear = (t: T, text: string): FieldCheck => {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: t("aYearIsA") };
  return checkWith(t, builtDetailsFields.year)(Number(trimmed));
};

type DetailsFormProps = { pool: ClientPool; change: (ops: PoolOp[]) => boolean };

/**
 * @function DetailsForm
 * @param props {DetailsFormProps} the pool and the change call
 * @returns {JSX.Element} the name, tournament, round, year and notes fields
 */
export function DetailsForm({ pool, change }: DetailsFormProps) {
  const t = useTranslations("pools.detailsForm");
  const save = (key: DetailKey) => (value: unknown) =>
    change([{ type: "setDetails", [key]: value } as PoolOp]);
  const text = (key: Exclude<DetailKey, "year">) => checkWith(t, builtDetailsFields[key]);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DetailField
        id="pool-name"
        label={t("name")}
        stored={pool.name}
        check={text("name")}
        onSave={save("name")}
      />
      <DetailField
        id="pool-tournament"
        label={t("tournament")}
        hint={t("emptyForNone")}
        stored={pool.tournament}
        check={text("tournament")}
        onSave={save("tournament")}
      />
      <DetailField
        id="pool-round"
        label={t("round")}
        hint={t("emptyForNone")}
        stored={pool.round}
        check={text("round")}
        onSave={save("round")}
      />
      <DetailField
        id="pool-year"
        label={t("year")}
        hint={t("emptyForNone")}
        inputMode="numeric"
        stored={pool.year === null ? "" : String(pool.year)}
        check={(text: string) => checkYear(t, text)}
        onSave={save("year")}
      />
      <div className="sm:col-span-2">
        <DetailField
          id="pool-notes"
          label={t("notes")}
          multiline
          stored={pool.notes}
          check={text("notes")}
          onSave={save("notes")}
        />
      </div>
    </div>
  );
}
