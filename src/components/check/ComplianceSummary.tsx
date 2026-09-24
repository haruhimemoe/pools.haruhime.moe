/**
 * @file src/components/check/ComplianceSummary.tsx
 * @desc The check's summary card: the headline in the tone of the worst verdict (not allowed,
 *       closer look, couldn't check, all clear) and the counts. Announced when it changes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { Card } from "@haruhimemoe/ui";
import type { CheckSummary } from "@/utils/compliance-view";

const TONE_CLASSES: Readonly<Record<CheckSummary["tone"], string>> = {
  disallowed: "text-rose-300",
  potential: "text-amber-300",
  unchecked: "text-c2",
  ok: "text-emerald-300",
};

export function ComplianceSummary({ summary }: { summary: CheckSummary }) {
  const { ok, potential, disallowed, unchecked } = summary.counts;
  return (
    <Card title="Summary" aria-live="polite">
      <p className={`font-bold ${TONE_CLASSES[summary.tone]}`}>{summary.headline}</p>
      <p className="text-c3 text-sm">
        {ok} allowed · {potential} need a closer look · {disallowed} not allowed · {unchecked}{" "}
        couldn't be checked
      </p>
    </Card>
  );
}
