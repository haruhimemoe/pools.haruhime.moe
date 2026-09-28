/**
 * @file tests/unit/tooling/readme-packages.test.ts
 * @desc The README's Packages section links every @haruhimemoe package in package.json, so the
 *       list of shared packages the site is built on stays complete, and names every entry point
 *       (`/format`, `/service`...) the code and tests import on that package's line.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";

const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
const section = /^## Packages\n([\s\S]*?)(?=^## )/m.exec(readme)?.[1] ?? "";
const shared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((name) =>
  name.startsWith("@haruhimemoe/"),
);

const sources = (dir: string): string[] =>
  readdirSync(path.join(process.cwd(), dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => readFileSync(path.join(process.cwd(), dir, file), "utf8"));

/** Every "<package> <entry>" the code, tests and scripts import, like "@haruhimemoe/osu format". */
const entries = [
  ...new Set(
    ["src", "tests", "scripts"]
      .flatMap(sources)
      .flatMap((text) => [...text.matchAll(/from "(@haruhimemoe\/[a-z-]+)\/([a-z-]+)"/g)])
      .map(([, name, entry]) => `${name} ${entry}`),
  ),
].sort();

const lineOf = (name: string): string =>
  section.split("\n").find((line) => line.startsWith(`- [\`${name}\`]`)) ?? "";

describe("README Packages section", () => {
  it("exists", () => {
    expect(section).not.toBe("");
  });

  it.each(shared)("links %s", (name) => {
    expect(section).toContain(`[\`${name}\`](https://www.npmjs.com/package/${name})`);
  });

  it("finds the entry points the code imports", () => {
    expect(entries).toContain("@haruhimemoe/pool service");
  });

  it.each(entries)("names %s on its package's line", (both) => {
    const [name = "", entry = ""] = both.split(" ");
    expect(lineOf(name)).toContain(`\`/${entry}\``);
  });
});
