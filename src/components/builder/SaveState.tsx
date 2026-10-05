/**
 * @file src/components/builder/SaveState.tsx
 * @desc The editor's saving bar, kept in view while scrolling: "Saving…" or "All changes saved."
 *       in a polite live region, and, announced as they come, a change that wasn't saved (and
 *       why), the 409 notice, and a pool that went away, with room for Undo beside the status.
 *       Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 4, 2026
 */

import { Button, Notice, Text } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import { MERGED_NOTICE } from "@/constants/built-pools";
import { CONFLICT, GONE } from "@/constants/editor";
import type { EditorFailure } from "@/schemas/pool-editor";

type SaveStateProps = {
  saving: boolean;
  failure: EditorFailure | null;
  conflict: boolean;
  /** The last save merged cleanly onto someone else's change (both are in). */
  merged: boolean;
  gone: boolean;
  onDismiss: () => void;
  /** Buttons beside the status (Undo). */
  actions?: ReactNode;
};

/**
 * @function SaveState
 * @param props {SaveStateProps} the editor's saving state, failure, conflict and gone
 * @returns {JSX.Element} what's happening to the changes, with Dismiss
 */
export function SaveState(props: SaveStateProps) {
  const { saving, failure, conflict, merged, gone, onDismiss, actions } = props;
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-lg bg-b5 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text role="status" tone="muted" bold>
          {saving ? "Saving…" : "All changes saved."}
        </Text>
        {actions}
      </div>
      {gone ? (
        <Notice tone="error" live>
          {GONE}
        </Notice>
      ) : null}
      {conflict ? (
        <Notice tone="warning" live>
          {CONFLICT}
        </Notice>
      ) : null}
      {merged ? (
        <Notice tone="info" live>
          {MERGED_NOTICE}
        </Notice>
      ) : null}
      {failure ? (
        <Notice tone="error" live>
          {failure.message}
        </Notice>
      ) : null}
      {conflict || failure ? (
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      ) : null}
    </div>
  );
}
