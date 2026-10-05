/**
 * @file src/components/history/ChangeList.tsx
 * @desc One revision's changes, in a Surface with a heading naming its date: a line per change
 *       (a map's line links osu!'s beatmap page), or an empty note for the root or a version
 *       nobody would see differently. The revert action, when offered, sits beside the heading.
 *       Server-safe.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { EmptyState, SectionHeading, Surface, TextLink } from "@haruhimemoe/ui";
import type { RevisionMeta } from "@haruhimemoe/vcs";
import type { ReactNode } from "react";
import { formatShortDate } from "@/utils/date";
import type { ChangeLine } from "@/utils/pool-changes";

type ChangeListProps = {
  revision: RevisionMeta;
  /** null for the root (nothing to diff against). */
  lines: ChangeLine[] | null;
  action?: ReactNode;
};

/**
 * @function ChangeList
 * @param props {ChangeListProps} the revision shown, its change lines (null for the root) and an
 *        optional revert action
 * @returns {JSX.Element} the heading and the lines, or an empty note
 */
export function ChangeList({ revision, lines, action }: ChangeListProps) {
  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeading level={3} detail={formatShortDate(revision.createdAt)} actions={action}>
        Changes in this version
      </SectionHeading>
      {lines === null ? (
        <p className="text-c2 text-sm">The first saved version.</p>
      ) : lines.length === 0 ? (
        <EmptyState size="sm">Nothing a person would see changed.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines carry no stable id of their own.
            <li key={index}>
              {line.beatmapId ? (
                <TextLink href={`https://osu.ppy.sh/b/${line.beatmapId}`}>{line.text}</TextLink>
              ) : (
                line.text
              )}
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
