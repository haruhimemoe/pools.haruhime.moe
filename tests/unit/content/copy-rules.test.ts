/**
 * @file tests/unit/content/copy-rules.test.ts
 * @desc Copy people read follows the house rules: no em dashes in the docs, the legal pages or the
 *       site's copy constants; nothing says every pool comes from otdb (hosts and community
 *       members send pools too), and the site description names no single source; the README
 *       stays a user doc (no maintainer notes) and starts with the banner; every doc ends with a
 *       newline.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE } from "@/constants/site";

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

/** Copy that says where pools come from: the docs, legal pages and constants, and the pages. */
const SOURCE_COPY = [
  ...COPY,
  "src/app/credits/page.tsx",
  "src/app/data/page.tsx",
  "src/app/submit/page.tsx",
  "src/components/home/HomeScreen.tsx",
  "src/components/layout/Footer.tsx",
];

/**
 * Ways of saying every pool comes from otdb: "pools come from otdb" or "pool data from otdb"
 * pass only when the same sentence also names hosts or the community, or says "some" pools. A
 * pool page's own otdb credit is fine. A period inside a link (otdb.sheppsu.me) doesn't end the
 * sentence.
 */
const REST_OF_SENTENCE = String.raw`(?:[^.]|\.(?=\S))*`;
const OTHERS_LATER_IN_SENTENCE = String.raw`(?!${REST_OF_SENTENCE}\b(?:hosts?|community)\b)`;
const OTDB_ONLY: readonly RegExp[] = [
  /every pool comes from/i,
  /all (?:the )?pools come from/i,
  new RegExp(
    String.raw`(?<!\bsome (?:past )?)pools come from (?:the public export of )?\[?otdb\b${OTHERS_LATER_IN_SENTENCE}`,
    "i",
  ),
  new RegExp(String.raw`pool data (?:comes )?from \[?otdb\b${OTHERS_LATER_IN_SENTENCE}`, "i"),
];

describe("copy rules", () => {
  it.each(COPY)("%s has no em dash", (file) => {
    expect(readFileSync(file, "utf8")).not.toContain("—");
  });

  it.each([
    "Every pool comes from otdb, by Sheppsu.",
    "Pool data from otdb by Sheppsu.",
    "Pool data comes from otdb, by Sheppsu.",
    "Pools come from otdb (by Sheppsu); an importer fills a database.",
    "Pools come from the public export of [otdb](https://otdb.sheppsu.me), by Sheppsu.",
  ])("catches %j", (sentence) => {
    expect(OTDB_ONLY.some((pattern) => pattern.test(sentence))).toBe(true);
  });

  it.each([
    "Pools come from otdb, tournament hosts and community members.",
    "Pools come from [otdb](https://otdb.sheppsu.me), tournament hosts and community members.",
    "Some past pools come from the public export of [otdb](https://otdb.sheppsu.me), by Sheppsu.",
    "Some pools come from otdb.",
  ])("lets %j through", (sentence) => {
    expect(OTDB_ONLY.some((pattern) => pattern.test(sentence))).toBe(false);
  });

  it.each(SOURCE_COPY)("%s doesn't say every pool comes from otdb", (file) => {
    const text = readFileSync(file, "utf8");
    expect(OTDB_ONLY.filter((pattern) => pattern.test(text))).toEqual([]);
  });

  it("keeps the site description free of any one source", () => {
    expect(SITE.description).not.toMatch(/otdb|sheppsu/i);
  });

  it("describes pools as where you build a pool, past pools as reference", () => {
    expect(SITE.description).toMatch(/^Build an osu! tournament mappool/);
    expect(SITE.description).toMatch(/past tournament pools as reference/);
  });

  it.each(DOCS)("%s ends with a newline", (file) => {
    expect(readFileSync(file, "utf8").endsWith("\n")).toBe(true);
  });

  it("starts the README with the banner", () => {
    const [first] = readFileSync("README.md", "utf8").split("\n");
    expect(first).toBe(
      '<p align="center"><a href="https://pools.haruhime.moe"><picture><source media="(prefers-color-scheme: light)" srcset="https://www.haruhime.moe/brand/repos/pools.haruhime.moe-banner-on-light.svg"><img alt="pools.haruhime.moe" src="https://www.haruhime.moe/brand/repos/pools.haruhime.moe-banner.svg" width="640"></picture></a></p>',
    );
  });

  it("keeps the README for users", () => {
    expect(readFileSync("README.md", "utf8")).not.toMatch(/runbook|vault|TODO|internal/i);
  });
});
