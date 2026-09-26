/**
 * @file tests/unit/content/legal-content.test.ts
 * @desc The legal pages keep the clauses that protect us and the promises the code keeps: not
 *       affiliated with ppy or the Tournament Committee, guidance not rulings, no-mod stars, the
 *       otdb credit beside the pools hosts and community members send (whose links are theirs,
 *       not ours), and the User-Agent
 *       (disclaimer); no visitor cookies, per-IP counters, the 24-hour cache, admin sessions and
 *       no osu! tokens, and what the all-maps search sends the hinai mirror (privacy, dated
 *       2026-09-26). No em dashes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";

const read = (slug: string) => readFileSync(`content/legal/${slug}.mdx`, "utf8");

describe("legal pages", () => {
  it.each([
    "isn't affiliated with or endorsed by ppy Pty Ltd or the osu! Tournament Committee",
    "guidance, not rulings",
    "without mods",
    "otdb",
    "Sheppsu",
    "tournament hosts",
    "community members",
    "checks those by hand",
    "those are their pages, not ours",
    "User-Agent",
  ])("the disclaimer says %j", (clause) => {
    expect(read("disclaimer")).toContain(clause);
  });

  it.each([
    "no cookies",
    "IP address",
    "24 hours",
    "7 days",
    "never osu! tokens",
    "sent to the hinai mirror (mirror.hinamizawa.ai)",
  ])("the privacy page says %j", (clause) => {
    expect(read("privacy")).toContain(clause);
  });

  it("dates the privacy page from its last change (the all-maps search line)", () => {
    expect(LEGAL_DOCS.privacy.lastUpdated).toBe("2026-09-26");
  });

  it.each(LEGAL_SLUGS)("%s has no em dash", (slug) => {
    expect(read(slug)).not.toContain("—");
  });
});
