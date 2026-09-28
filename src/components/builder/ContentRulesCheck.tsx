/**
 * @file src/components/builder/ContentRulesCheck.tsx
 * @desc "Check against the content rules" for a built pool: the /check service (GET /api/check,
 *       osu! facts cached) run on the pool's maps when asked, shown with /check's own summary
 *       and table, one row per slot. It says when the pool has changed since the last check, and
 *       that the check is a guide, not a ruling. Nothing here stops a map from being used.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import type { PoolSlot } from "@haruhimemoe/pool";
import { Button, Notice } from "@haruhimemoe/ui";
import { useMemo, useState } from "react";
import { CheckResults } from "@/components/check/CheckResults";
import { ComplianceSummary } from "@/components/check/ComplianceSummary";
import { useComplianceCheck } from "@/hooks/useComplianceCheck";
import { checkIdsOf, checkRowsOf } from "@/utils/built-editor";
import { summarizeCheck } from "@/utils/compliance-view";

/** The rules' pages, read from @haruhimemoe/compliance on the server. */
export type CheckRules = { contentUsage: string; officialSupport: string; project: string };

type ContentRulesCheckProps = { slots: readonly PoolSlot[]; rules: CheckRules };

export function ContentRulesCheck({ slots, rules }: ContentRulesCheckProps) {
  const [asked, setAsked] = useState<readonly PoolSlot[] | null>(null);
  const ids = useMemo(() => (asked ? checkIdsOf(asked) : []), [asked]);
  const { check, retry } = useComplianceCheck(ids);
  const changed = asked !== null && checkIdsOf(slots).join(",") !== ids.join(",");
  const run = () => {
    setAsked([...slots]);
    retry();
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-c2">
        Checks each map against the content rules for officially supported tournaments.
      </p>
      <Button
        variant="secondary"
        className="self-start"
        disabled={slots.length === 0}
        onClick={run}
      >
        {asked ? "Check again" : "Check the maps"}
      </Button>
      <p role="status" className="text-c3">
        {check.status === "loading"
          ? "Checking…"
          : changed
            ? "The pool changed since this check."
            : ""}
      </p>
      {check.status === "error" ? (
        <Notice tone="error" live>
          {check.message}
        </Notice>
      ) : null}
      {check.status === "ready" && asked ? (
        <>
          <ComplianceSummary
            summary={summarizeCheck(check.result, ids)}
            title="Result"
            headingLevel={4}
            className="border border-b3"
          />
          <CheckResults rows={checkRowsOf(asked)} result={check.result} />
        </>
      ) : null}
      <p className="text-c3 text-xs">
        A guide, not a ruling: the osu! Tournament Committee decides. It follows the osu! wiki's{" "}
        <a href={rules.contentUsage} className="underline">
          content usage permissions
        </a>{" "}
        and{" "}
        <a href={rules.officialSupport} className="underline">
          official support
        </a>{" "}
        pages, through the rules of the{" "}
        <a href={rules.project} className="underline">
          osu! Mappool Compliance project
        </a>
        .
      </p>
    </div>
  );
}
