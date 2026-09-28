/**
 * @file src/components/check/ComplianceSummary.tsx
 * @desc The check's summary card: the headline in the tone of the worst verdict (not allowed,
 *       closer look, couldn't check, all clear) and the counts. Announced when it changes. The
 *       pool editor shows it under its own heading, so the title and heading level can change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { Card, cx } from "@haruhimemoe/ui";
import type { CheckSummary } from "@/utils/compliance-view";

const TONE_CLASSES: Readonly<Record<CheckSummary["tone"], string>> = {
  disallowed: "text-rose-300",
  potential: "text-amber-300",
  unchecked: "text-c2",
  ok: "text-emerald-300",
};

type ComplianceSummaryProps = {
  summary: CheckSummary;
  title?: string;
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/**
 * @function ComplianceSummary
 * @param props {ComplianceSummaryProps} the check's summary
 * @returns {JSX.Element} the headline verdict and the counts behind it
 */
export function ComplianceSummary({
  summary,
  title = "Summary",
  headingLevel = 2,
  className,
}: ComplianceSummaryProps) {
  const { ok, potential, disallowed, unchecked } = summary.counts;
  return (
    <Card title={title} headingLevel={headingLevel} className={className} aria-live="polite">
      <p className={cx("font-bold", TONE_CLASSES[summary.tone])}>{summary.headline}</p>
      <p className="text-c3 text-sm">
        {ok} allowed · {potential} need a closer look · {disallowed} not allowed · {unchecked}{" "}
        couldn't be checked
      </p>
    </Card>
  );
}
