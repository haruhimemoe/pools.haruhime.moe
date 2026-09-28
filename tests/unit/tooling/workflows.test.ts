/**
 * @file tests/unit/tooling/workflows.test.ts
 * @desc Every GitHub Action runs from a full commit SHA (with its version in a comment), and
 *       Dependabot keeps the bun dependencies and the actions current.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS = path.join(process.cwd(), ".github", "workflows");

describe("workflows", () => {
  it("pin every action to a commit SHA", () => {
    const loose = readdirSync(WORKFLOWS).flatMap((file) =>
      readFileSync(path.join(WORKFLOWS, file), "utf8")
        .split("\n")
        .filter((line) => /^\s*(?:-\s+)?uses:/.test(line))
        .filter((line) => !/uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d/.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(loose).toEqual([]);
  });
});

describe("dependabot", () => {
  const config = readFileSync(path.join(process.cwd(), ".github", "dependabot.yml"), "utf8");

  it.each(["bun", "github-actions"])("updates the %s ecosystem", (ecosystem) => {
    expect(config).toContain(`package-ecosystem: ${ecosystem}`);
  });
});
