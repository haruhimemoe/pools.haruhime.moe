/**
 * @file tests/unit/content/legal-content.test.ts
 * @desc The legal pages keep the clauses that protect us and the promises the code keeps: not
 *       affiliated with ppy or the Tournament Committee, guidance not rulings, where star ratings with mods come from, the
 *       otdb credit beside the pools hosts and community members send (whose links are theirs,
 *       not ours), and the User-Agent
 *       (disclaimer); no visitor cookies, per-IP counters, the 24-hour cache, what signing in
 *       stores (osu! id, username, avatar, country, sessions, the pools you make, never osu!
 *       tokens), the readable signed-in cookie, who sees public, unlisted and private pools,
 *       moderation and deletion, and what the all-maps search sends the hinai mirror (privacy,
 *       dated 2026-09-27), per-account counters, the editor lookup, the cascade on deleting and
 *       built pools' packs on packs;
 *       the disclaimer's osu! and packs requests for built pools (2026-09-27); the terms (anyone
 *       with osu! can sign in, what's allowed, shared pools published on packs, moderation,
 *       deletion, dated 2026-09-27). No em dashes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
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
    "Star ratings with mods come from the hinai mirror",
    "can differ slightly from osu!'s",
    "otdb",
    "Sheppsu",
    "tournament hosts",
    "community members",
    "checks those by hand",
    "those are their pages, not ours",
    "User-Agent",
    "to look up a pool editor by username",
    "to remove a pack when its pool goes private or is deleted",
    "trying again later when packs doesn't answer",
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
    "Anyone with an osu! account can sign in",
    "osu! user ID, username, avatar URL and country",
    "the pools you make",
    "pools-signed-in",
    "Public and unlisted pools can be seen by anyone with the link",
    "Private pools are seen only by you and the editors you add",
    "Admins can hide or delete",
    "Delete my account",
    "per account",
    "look it up on the osu! API",
    "every pool you own",
    "7 days after you last use the site",
    "osu! usernames and IDs of its owner and editors",
    "use your osu! user ID, so deleting your account and signing in again doesn't reset them",
    "your account and pools are still deleted",
    "pack updates",
    "Unlisted and public pools with maps also get a pack on packs.haruhime.moe",
    "Making a pool private or deleting it removes its pack",
  ])("the privacy page says %j", (clause) => {
    expect(read("privacy")).toContain(clause);
  });

  it.each([
    "Anyone with an osu! account can sign in",
    "content filter",
    "Admins can hide or delete",
    "Delete my account",
    "can't be undone",
    "isn't affiliated with or endorsed by ppy Pty Ltd",
    "published as a pack on packs.haruhime.moe",
  ])("the terms say %j", (clause) => {
    expect(read("terms")).toContain(clause);
  });

  it("says map covers and preview clips load straight from osu!'s servers", () => {
    expect(read("privacy")).toContain("straight from osu!'s servers (assets.ppy.sh and b.ppy.sh)");
  });

  it("dates the privacy page (editor v2.1), disclaimer and terms from their last change", () => {
    expect(LEGAL_DOCS.privacy.lastUpdated).toBe("2026-09-28");
    expect(LEGAL_DOCS.disclaimer.lastUpdated).toBe("2026-09-27");
    expect(LEGAL_DOCS.terms.lastUpdated).toBe("2026-09-27");
  });

  it.each(LEGAL_SLUGS)("%s has no em dash", (slug) => {
    expect(read(slug)).not.toContain("—");
  });
});
