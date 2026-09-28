/**
 * @file src/components/admin/BuiltModerationArea.tsx
 * @desc The built pools table's live region on /admin: each row's moderation buttons say here
 *       what happened (hidden, shown again, deleted and when packs removes the pack later, or
 *       that it didn't work). It stays mounted while the page refreshes, so a deleted pool's
 *       message outlives its row, and focus lands on it after a delete.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { createContext, type ReactNode, useCallback, useRef, useState } from "react";

/** Says `text` in the table's live region; `focus` moves focus there (the row may be gone). */
export type SayModeration = (text: string, focus?: boolean) => void;

export const ModerationNotice = createContext<SayModeration>(() => {});

export function BuiltModerationArea({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const region = useRef<HTMLOutputElement>(null);
  const say = useCallback<SayModeration>((next, focus = false) => {
    setText(next);
    if (focus) region.current?.focus();
  }, []);
  return (
    <ModerationNotice value={say}>
      <output ref={region} tabIndex={-1} aria-live="polite" className="block text-c2 text-sm">
        {text}
      </output>
      {children}
    </ModerationNotice>
  );
}
