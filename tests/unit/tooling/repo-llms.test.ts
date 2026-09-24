/**
 * @file tests/unit/tooling/repo-llms.test.ts
 * @desc The repo's llms.txt only links files that exist in the repo.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PREFIX =
  /https:\/\/github\.com\/haruhimemoe\/pools\.haruhime\.moe\/(?:blob|tree)\/main\/([^)#\s]+)/g;
const paths = [...readFileSync("llms.txt", "utf8").matchAll(PREFIX)].map((match) => match[1] ?? "");

describe("llms.txt", () => {
  it("links some files", () => {
    expect(paths.length).toBeGreaterThan(3);
  });

  it.each(paths)("links %s, which exists", (file) => {
    expect(existsSync(file)).toBe(true);
  });
});
