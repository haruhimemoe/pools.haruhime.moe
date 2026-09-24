/**
 * @file tests/unit/tooling/client-imports.test.ts
 * @desc Client code never imports the @haruhimemoe/osu root (it holds the osu! secret) or
 *       @haruhimemoe/compliance (its rules' data stays on the server).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
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
});
