/**
 * @file src/utils/undo-keys.ts
 * @desc The editor's undo shortcut: Ctrl+Z or Cmd+Z without Shift or Alt, and only while focus
 *       isn't in a field you type into (those keep their own undo). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

type KeyPress = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

/** Input types that aren't typed into. */
const NOT_TEXT = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "range",
  "color",
  "file",
]);

/**
 * @function isUndoKey
 * @param event {KeyPress} a key press
 * @returns {boolean} true for Ctrl+Z or Cmd+Z (no Shift, no Alt)
 */
export const isUndoKey = (event: KeyPress): boolean =>
  (event.ctrlKey || event.metaKey) &&
  !event.shiftKey &&
  !event.altKey &&
  event.key.toLowerCase() === "z";

/**
 * @function typesText
 * @param target {{ tagName: string; type?: string; isContentEditable: boolean } | null} where
 *        focus is
 * @returns {boolean} true for a text input, a textarea, a select or editable content
 */
export const typesText = (
  target: { tagName: string; type?: string; isContentEditable: boolean } | null,
): boolean => {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  return target.tagName === "INPUT" && !NOT_TEXT.has(target.type ?? "text");
};
