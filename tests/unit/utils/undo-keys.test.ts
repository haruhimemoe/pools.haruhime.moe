/**
 * @file tests/unit/utils/undo-keys.test.ts
 * @desc Ctrl+Z and Cmd+Z undo in the editor, but not with Shift or Alt (redo and other
 *       shortcuts), and never while focus is in something you type into.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { isUndoKey, typesText } from "@/utils/undo-keys";

const key = (over: Partial<Parameters<typeof isUndoKey>[0]>) => ({
  key: "z",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe("undo keys", () => {
  it("takes Ctrl+Z and Cmd+Z only", () => {
    expect(isUndoKey(key({ ctrlKey: true }))).toBe(true);
    expect(isUndoKey(key({ metaKey: true, key: "Z" }))).toBe(true);
    expect(isUndoKey(key({}))).toBe(false);
    expect(isUndoKey(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isUndoKey(key({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isUndoKey(key({ ctrlKey: true, key: "y" }))).toBe(false);
  });

  it("leaves text fields their own undo", () => {
    expect(typesText({ tagName: "INPUT", type: "text", isContentEditable: false })).toBe(true);
    expect(typesText({ tagName: "TEXTAREA", isContentEditable: false })).toBe(true);
    expect(typesText({ tagName: "SELECT", isContentEditable: false })).toBe(true);
    expect(typesText({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(typesText({ tagName: "INPUT", type: "checkbox", isContentEditable: false })).toBe(false);
    expect(typesText({ tagName: "BUTTON", isContentEditable: false })).toBe(false);
    expect(typesText(null)).toBe(false);
  });
});
