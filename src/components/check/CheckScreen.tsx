/**
 * @file src/components/check/CheckScreen.tsx
 * @desc The check page: paste beatmap IDs or links, a pool, or a pack key (read in that order of
 *       precedence: key, pool, IDs), then the summary and a row per map. What couldn't be read
 *       or checked is said. Every press of Check asks again, even for the same paste, and "Check
 *       again" shows after a failed check (429, network error, 5xx) and for maps osu! didn't
 *       answer. Never blocks anything, and always says it's a guide, not a ruling.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button, Notice, PageHeader, Textarea } from "@haruhimemoe/ui";
import { type FormEvent, useMemo, useState } from "react";
import { CheckResults } from "@/components/check/CheckResults";
import { ComplianceSummary } from "@/components/check/ComplianceSummary";
import { useComplianceCheck } from "@/hooks/useComplianceCheck";
import { type CheckInput, checkIds, readCheckInput } from "@/utils/check-input";
import { summarizeCheck } from "@/utils/compliance-view";

type Rules = { contentUsage: string; officialSupport: string; project: string };

export function CheckScreen({ rules }: { rules: Rules }) {
  const [text, setText] = useState("");
  const [input, setInput] = useState<CheckInput | null>(null);
  const ids = useMemo(() => (input ? checkIds(input) : []), [input]);
  const { check, retry } = useComplianceCheck(ids);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInput(readCheckInput(text));
    retry();
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Check a pool"
        lead="Paste beatmap IDs or links, a pool (a slot and a map on each line), or a pack key. Each map is checked against the content rules for officially supported tournaments."
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Textarea
          id="check-input"
          label="Maps to check"
          hint="A pack key is read first, then slot lines like NM1 129891, then bare IDs and links. Up to 64 maps."
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
        />
        <Button type="submit" className="self-start">
          Check
        </Button>
      </form>
      {input?.problems.map((problem) => (
        <Notice key={problem} tone="warning">
          {problem}
        </Notice>
      ))}
      {input?.kind === "key" && input.name ? (
        <p className="text-c3 text-sm">Pack key: {input.name}</p>
      ) : null}
      {check.status === "loading" ? <p className="text-c3 text-sm">Checking…</p> : null}
      {check.status === "error" ? (
        <>
          <Notice tone="error" live>
            {check.message}
          </Notice>
          <Button variant="secondary" className="self-start" onClick={retry}>
            Check again
          </Button>
        </>
      ) : null}
      {check.status === "ready" && input && input.kind !== "empty" ? (
        <>
          <ComplianceSummary summary={summarizeCheck(check.result, ids)} />
          {check.result.unchecked.length > 0 ? (
            <Button variant="secondary" className="self-start" onClick={retry}>
              Check again
            </Button>
          ) : null}
          <CheckResults rows={input.rows} result={check.result} />
        </>
      ) : null}
      <p className="text-c3 text-sm">
        This is a guide, not a ruling: the osu! Tournament Committee decides. It follows the osu!
        wiki's{" "}
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
        . Nothing here stops you from using a map.
      </p>
    </div>
  );
}
