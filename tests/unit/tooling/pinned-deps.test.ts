/**
 * @file tests/unit/tooling/pinned-deps.test.ts
 * @desc Every dependency is pinned to an exact version (no ^, ~, ranges or tags), so a new
 *       release (ours on npm included) never lands without a deliberate bump, and the shared
 *       @haruhimemoe packages sit at the versions pools is built and tested against.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** The shared packages and the versions pools uses (hinai 0.3 needs osu 0.3, one copy). */
const SHARED: Readonly<Record<string, string>> = {
  "@haruhimemoe/ui": "0.14.0",
  "@haruhimemoe/osu": "0.4.0",
  "@haruhimemoe/hinai": "0.3.1",
  "@haruhimemoe/next-kit": "0.8.0",
  "@haruhimemoe/pool": "0.2.0",
  "@haruhimemoe/compliance": "0.1.1",
  "@haruhimemoe/brand": "0.7.0",
  "@haruhimemoe/vcs": "0.1.0",
};

describe("package.json", () => {
  it.each([
    ["dependencies", pkg.dependencies],
    ["devDependencies", pkg.devDependencies],
  ])("pins every entry in %s", (_, deps) => {
    const loose = Object.entries(deps).filter(([, version]) => !EXACT.test(version));
    expect(loose).toEqual([]);
  });

  it("pins the shared packages at the versions pools is built for", () => {
    const all: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
    const shared = Object.fromEntries(
      Object.entries(all).filter(([name]) => name.startsWith("@haruhimemoe/")),
    );
    expect(shared).toEqual(SHARED);
  });
});
