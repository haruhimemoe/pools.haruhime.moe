/**
 * @file tests/unit/content/copy-rules.test.ts
 * @desc Copy people read follows the house rules: no em dashes in the docs, the legal pages or the
 *       site's copy constants; the README stays a user doc (no maintainer notes); every doc ends
 *       with a newline.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOCS = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "llms.txt",
];
const COPY = [
  ...DOCS,
  ...readdirSync("content/legal").map((name) => `content/legal/${name}`),
  "src/constants/site.ts",
  "src/constants/legal.ts",
  "src/utils/llms-txt.ts",
];

describe("copy rules", () => {
  it.each(COPY)("%s has no em dash", (file) => {
    expect(readFileSync(file, "utf8")).not.toContain("—");
  });

  it.each(DOCS)("%s ends with a newline", (file) => {
    expect(readFileSync(file, "utf8").endsWith("\n")).toBe(true);
  });

  it("keeps the README for users", () => {
    expect(readFileSync("README.md", "utf8")).not.toMatch(/runbook|vault|TODO|internal/i);
  });
});
