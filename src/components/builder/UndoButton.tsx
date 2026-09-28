/**
 * @file src/components/builder/UndoButton.tsx
 * @desc Undo in the editor's saving bar: puts back this session's last change (up to 20 steps,
 *       no redo), and Ctrl+Z or Cmd+Z does the same while focus isn't in a field you type into
 *       (those keep their own undo). Disabled with nothing to undo.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { useEffect, useRef } from "react";
import { isUndoKey, typesText } from "@/utils/undo-keys";

type UndoButtonProps = { steps: number; onUndo: () => void };

/**
 * @function UndoButton
 * @param props {UndoButtonProps} how many steps can be undone and the undo call
 * @returns {JSX.Element} Undo, with Ctrl/Cmd+Z outside text fields
 */
export function UndoButton({ steps, onUndo }: UndoButtonProps) {
  const latest = useRef(onUndo);
  latest.current = onUndo;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const focused = document.activeElement as HTMLInputElement | null;
      if (!isUndoKey(event) || typesText(focused)) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Button
      variant="secondary"
      disabled={steps === 0}
      title={
        steps > 0 ? `${steps} ${steps === 1 ? "change" : "changes"} to undo (Ctrl+Z)` : undefined
      }
      onClick={onUndo}
    >
      Undo
    </Button>
  );
}
