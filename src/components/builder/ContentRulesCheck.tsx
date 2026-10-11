/**
 * @file src/components/builder/ContentRulesCheck.tsx
 * @desc "Check against the content rules" for a built pool: the /check service (GET /api/check,
 *       osu! facts cached) run on the pool's maps when asked, shown with /check's own summary
 *       and table, one row per slot. It says when the pool has changed since the last check, and
 *       that the check is a guide, not a ruling. Nothing here stops a map from being used.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import type { PoolSlot } from "@haruhimemoe/pool";
import { Button, Notice } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CheckResults } from "@/components/check/CheckResults";
import { ComplianceSummary } from "@/components/check/ComplianceSummary";
import { useComplianceCheck } from "@/hooks/useComplianceCheck";
import { checkIdsOf, checkRowsOf } from "@/utils/built-editor";
import { summarizeCheck } from "@/utils/compliance-view";

/** The rules' pages, read from @haruhimemoe/compliance on the server. */
export type CheckRules = { contentUsage: string; officialSupport: string; project: string };

type ContentRulesCheckProps = { slots: readonly PoolSlot[]; rules: CheckRules };

/**
 * @function ContentRulesCheck
 * @param props {ContentRulesCheckProps} the pool's slots and the rules
 * @returns {JSX.Element} the compliance check of the pool's maps, run in the browser on request
 */
export function ContentRulesCheck({ slots, rules }: ContentRulesCheckProps) {
  const t = useTranslations("pools.contentRulesCheck");
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
      <p className="text-c2">{t("checksEachMapAgainst")}</p>
      <Button variant="secondary" disabled={slots.length === 0} onClick={run}>
        {asked ? t("checkAgain") : t("checkTheMaps")}
      </Button>
      <p role="status" className="text-c3">
        {check.status === "loading" ? t("checking") : changed ? t("thePoolChangedSince") : ""}
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
            title={t("result")}
            headingLevel={4}
            className="border border-b3"
          />
          <CheckResults rows={checkRowsOf(asked)} result={check.result} />
        </>
      ) : null}
      <p className="text-c3 text-xs">
        A guide, not a ruling: the osu! Tournament Committee decides. It follows the osu! wiki's{" "}
        <a href={rules.contentUsage} className="underline">
          {t("contentUsagePermissions")}
        </a>{" "}
        and{" "}
        <a href={rules.officialSupport} className="underline">
          {t("officialSupport")}
        </a>{" "}
        pages, through the rules of the{" "}
        <a href={rules.project} className="underline">
          {t("osuMappoolComplianceProject")}
        </a>
        .
      </p>
    </div>
  );
}
