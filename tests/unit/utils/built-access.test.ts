/**
 * @file tests/unit/utils/built-access.test.ts
 * @desc Who may do what to a built pool, for the owner, an editor (matched by osu! id, so one
 *       added before signing in counts once they do), an admin, anyone else and a visitor, over
 *       private, unlisted and public pools, hidden or not: seeing it, changing its maps and
 *       details, managing it (visibility, editors) and deleting it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import type { Visibility } from "@/constants/built-pools";
import { accessOf, type Caller } from "@/utils/built-access";
import { makeBuiltPool } from "../../helpers/built-pools";

const OWNER_ID = "0123456789abcdef01234567";
const CALLERS: Record<string, Caller> = {
  owner: { id: OWNER_ID, osuId: 1, isAdmin: false },
  editor: { id: "u-editor", osuId: 2, isAdmin: false },
  admin: { id: "u-admin", osuId: 3, isAdmin: true },
  other: { id: "u-other", osuId: 4, isAdmin: false },
  visitor: null,
};

const pool = (visibility: Visibility, hidden: boolean) =>
  makeBuiltPool({
    ownerId: OWNER_ID,
    visibility,
    hidden,
    editors: [{ userId: null, osuId: 2, username: "ed", addedAt: new Date() }],
  });

/** view, edit, manage, delete as a 4-letter code (v e m d, "-" for no). */
const codeOf = (visibility: Visibility, hidden: boolean, who: string) => {
  const access = accessOf(pool(visibility, hidden), CALLERS[who] ?? null);
  return [
    access.canView ? "v" : "-",
    access.canEdit ? "e" : "-",
    access.canManage ? "m" : "-",
    access.canDelete ? "d" : "-",
  ].join("");
};

describe("accessOf", () => {
  it.each<[Visibility, boolean, Record<string, string>]>([
    [
      "private",
      false,
      { owner: "vemd", editor: "ve--", admin: "---d", other: "----", visitor: "----" },
    ],
    [
      "unlisted",
      false,
      { owner: "vemd", editor: "ve--", admin: "v--d", other: "v---", visitor: "v---" },
    ],
    [
      "public",
      false,
      { owner: "vemd", editor: "ve--", admin: "v--d", other: "v---", visitor: "v---" },
    ],
    [
      "private",
      true,
      { owner: "vemd", editor: "ve--", admin: "---d", other: "----", visitor: "----" },
    ],
    [
      "unlisted",
      true,
      { owner: "vemd", editor: "ve--", admin: "v--d", other: "----", visitor: "----" },
    ],
    [
      "public",
      true,
      { owner: "vemd", editor: "ve--", admin: "v--d", other: "----", visitor: "----" },
    ],
  ])("%s, hidden %s", (visibility, hidden, expected) => {
    for (const [who, code] of Object.entries(expected)) {
      expect(`${who}: ${codeOf(visibility, hidden, who)}`).toBe(`${who}: ${code}`);
    }
  });

  it("names the owner and editor roles", () => {
    expect(accessOf(pool("private", false), CALLERS.owner ?? null)).toMatchObject({
      isOwner: true,
      isEditor: false,
    });
    expect(accessOf(pool("private", false), CALLERS.editor ?? null)).toMatchObject({
      isOwner: false,
      isEditor: true,
    });
  });
});
