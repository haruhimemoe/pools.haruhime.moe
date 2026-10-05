/**
 * @file tests/unit/utils/built-history-access.test.ts
 * @desc historyAccessOf: owner and editor always read; a visitor reads a public or unlisted
 *       pool's history only with historyPublic on; nobody but members and admins reads a hidden
 *       pool's history; an admin reads any non-private pool's history even with historyPublic
 *       off, but never reverts or toggles; only the owner toggles; owner and editors revert.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import type { HistoryGuarded } from "@/utils/built-history-access";
import { historyAccessOf } from "@/utils/built-history-access";

const OWNER_ID = "owner-id";
const EDITOR_OSU_ID = 20;

const pool = (over: Partial<HistoryGuarded> = {}): HistoryGuarded => ({
  ownerId: OWNER_ID,
  editors: [{ userId: null, osuId: EDITOR_OSU_ID, username: "editor", addedAt: new Date() }],
  visibility: "public",
  hidden: false,
  historyPublic: undefined,
  ...over,
});

const owner = { id: OWNER_ID, osuId: 10, isAdmin: false };
const editor = { id: "editor-id", osuId: EDITOR_OSU_ID, isAdmin: false };
const visitor = { id: "other", osuId: 99, isAdmin: false };
const admin = { id: "admin-id", osuId: 1, isAdmin: true };

describe("historyAccessOf", () => {
  it("lets the owner and an editor always read, and both revert", () => {
    expect(historyAccessOf(pool(), owner)).toMatchObject({ canRead: true, canRevert: true });
    expect(historyAccessOf(pool(), editor)).toMatchObject({ canRead: true, canRevert: true });
  });

  it("only lets a visitor read a public or unlisted pool with historyPublic on", () => {
    expect(historyAccessOf(pool({ visibility: "public" }), visitor)).toMatchObject({
      canRead: false,
    });
    expect(
      historyAccessOf(pool({ visibility: "unlisted", historyPublic: true }), visitor),
    ).toMatchObject({ canRead: true, canRevert: false });
  });

  it("hides a hidden pool's history from everyone but members and admins (moderators still see it)", () => {
    const hidden = pool({ hidden: true, historyPublic: true });
    expect(historyAccessOf(hidden, visitor)).toMatchObject({ canRead: false });
    expect(historyAccessOf(hidden, admin)).toMatchObject({ canRead: true, canRevert: false });
    expect(historyAccessOf(hidden, owner)).toMatchObject({ canRead: true });
  });

  it("lets an admin read any non-private pool's history, never revert or toggle", () => {
    const quiet = pool({ visibility: "unlisted", historyPublic: false });
    expect(historyAccessOf(quiet, admin)).toMatchObject({
      canRead: true,
      canRevert: false,
      canToggle: false,
    });
    expect(historyAccessOf(pool({ visibility: "private" }), admin)).toMatchObject({
      canRead: false,
    });
  });

  it("only the owner toggles historyPublic", () => {
    expect(historyAccessOf(pool(), owner)).toMatchObject({ canToggle: true });
    expect(historyAccessOf(pool(), editor)).toMatchObject({ canToggle: false });
  });
});
