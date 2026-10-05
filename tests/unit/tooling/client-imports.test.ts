/**
 * @file tests/unit/tooling/client-imports.test.ts
 * @desc Client code never imports the @haruhimemoe/osu root (it holds the osu! secret),
 *       @haruhimemoe/compliance (its rules' data stays on the server), or
 *       @haruhimemoe/next-kit/vcs (it loads mongodb; client files may still import types from
 *       @haruhimemoe/vcs, which is browser-safe).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
  });

describe("client imports", () => {
  it("keep the osu! client and the compliance rules on the server", () => {
    const offenders = files("src").filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        source.includes('"use client"') && /from "@haruhimemoe\/(osu|compliance)"/.test(source)
      );
    });
    expect(offenders).toEqual([]);
  });

  it("keeps the revision store's mongodb-loading entry on the server", () => {
    const offenders = files("src").filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes('"use client"') && /from "@haruhimemoe\/next-kit\/vcs"/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
