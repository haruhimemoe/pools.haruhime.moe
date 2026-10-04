/**
 * @file src/components/check/ComplianceSummary.tsx
 * @desc The check's summary card: the headline in the tone of the worst verdict (not allowed,
 *       closer look, couldn't check, all clear) and the counts. Announced when it changes. The
 *       pool editor shows it under its own heading, so the title and heading level can change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { Card, Text, type TextTone } from "@haruhimemoe/ui";
import type { CheckSummary } from "@/utils/compliance-view";

/** A summary has no "missing" tone, unlike a row's verdict. */
const TONES: Readonly<Record<CheckSummary["tone"], TextTone>> = {
  disallowed: "error",
  potential: "warning",
  unchecked: "default",
  ok: "success",
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
      <Text tone={TONES[summary.tone]} size="base" bold>
        {summary.headline}
      </Text>
      <Text tone="muted">
        {ok} allowed · {potential} need a closer look · {disallowed} not allowed · {unchecked}{" "}
        couldn't be checked
      </Text>
    </Card>
  );
}
