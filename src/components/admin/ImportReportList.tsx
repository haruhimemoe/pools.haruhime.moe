/**
 * @file src/components/admin/ImportReportList.tsx
 * @desc The newest import runs: when, whether they ended well, their counts, and the full printed
 *       report behind a disclosure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { StoredImportReport } from "@/models/ImportReport";

export function ImportReportList({ reports }: { reports: readonly StoredImportReport[] }) {
  if (reports.length === 0) return <p className="text-c3 text-sm">No imports yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => (
        <li key={report._id.toHexString()}>
          <details className="rounded-lg bg-b5 p-3">
            <summary className="cursor-pointer text-sm">
              <span className="font-bold text-c1">
                {report.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </span>
              {" · "}
              {report.ok ? "done" : "stopped"} · {report.counts.created} new,{" "}
              {report.counts.updated} updated, {report.counts.superseded} superseded,{" "}
              {report.counts.skipped} skipped
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre text-c2 text-xs">{report.text}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}
