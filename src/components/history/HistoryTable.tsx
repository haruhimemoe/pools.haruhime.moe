/**
 * @file src/components/history/HistoryTable.tsx
 * @desc A pool's history as a table: when, who, what kind of save, and a link to its changes.
 *       The selected revision's link carries aria-current. An older page is a LinkRow underneath.
 *       Server-safe.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { LinkRow, Table, TBody, Td, TextLink, THead, Th } from "@haruhimemoe/ui";
import type { RevisionMeta } from "@haruhimemoe/vcs";
import { REVISION_LABELS } from "@/constants/history";
import { formatShortDate } from "@/utils/date";

type HistoryTableProps = {
  poolId: string;
  revisions: readonly RevisionMeta[];
  selected: string | undefined;
  older: number | null;
};

/**
 * @function HistoryTable
 * @param props {HistoryTableProps} the pool id, its revisions (newest first), the one shown and
 *        an older page's cursor
 * @returns {JSX.Element} the table, and a link to older versions when there's a next page
 */
export function HistoryTable({ poolId, revisions, selected, older }: HistoryTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <Table caption="Versions">
        <THead>
          <tr>
            <Th scope="col">When</Th>
            <Th scope="col">Who</Th>
            <Th scope="col">What</Th>
            <Th scope="col">
              <span className="sr-only">Changes</span>
            </Th>
          </tr>
        </THead>
        <TBody>
          {revisions.map((revision) => {
            const current = revision.id === selected;
            return (
              <tr key={revision.id}>
                <Td>{formatShortDate(revision.createdAt)}</Td>
                <Td>{revision.authorName}</Td>
                <Td>
                  {REVISION_LABELS[revision.kind]}
                  {revision.message ? `: ${revision.message}` : ""}
                </Td>
                <Td>
                  <TextLink
                    href={`/pools/${poolId}/history?rev=${revision.id}`}
                    aria-current={current ? "true" : undefined}
                  >
                    Changes
                  </TextLink>
                </Td>
              </tr>
            );
          })}
        </TBody>
      </Table>
      {older !== null ? (
        <LinkRow
          items={[
            {
              href: `/pools/${poolId}/history?before=${older}`,
              label: "Older versions",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
