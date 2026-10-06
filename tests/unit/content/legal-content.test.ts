/**
 * @file tests/unit/content/legal-content.test.ts
 * @desc The legal pages keep the clauses that protect us and the promises the code keeps: not
 *       affiliated with ppy or the Tournament Committee, guidance not rulings, where star ratings with mods come from, the
 *       otdb credit beside the pools hosts and community members send (whose links are theirs,
 *       not ours), and the User-Agent
 *       (disclaimers); no visitor cookies, per-IP counters, the 24-hour cache, what signing in
 *       stores (osu! id, username, avatar, country, sessions, the pools you make, never osu!
 *       tokens), the readable signed-in cookie, who sees public, unlisted and private pools,
 *       moderation and deletion, and what the all-maps search sends the hinai mirror (privacy,
 *       dated 2026-10-05), per-account counters, the editor lookup, the cascade on deleting and
 *       built pools' packs on packs;
 *       the disclaimers page's osu! and packs requests for built pools (dated 2026-10-05); the
 *       terms (anyone with osu! can sign in, what's allowed, shared pools published on packs,
 *       moderation, deletion, dated 2026-10-05); the your-privacy-rights page (GDPR and CCPA
 *       rights) and the copyright page (DMCA notice, sources, no hosted files). No em dashes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { readFileSync } from "node:fs";
import { findEntry } from "@haruhimemoe/next-kit/docs";
import { describe, expect, it } from "vitest";
import { CONTENT } from "@/constants/content";

const LEGAL_SLUGS = CONTENT.entries.legal.map((e) => e.slug);
const updated = (slug: string) => findEntry(CONTENT, "legal", slug)?.lastUpdated;

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
  ])("the disclaimers page says %j", (clause) => {
    expect(read("disclaimers")).toContain(clause);
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

  it("says who sees a pool's activity log, how long it's kept, and what deleting does", () => {
    const privacy = read("privacy");
    expect(privacy).toContain("Only the pool's owner and editors see it.");
    expect(privacy).toContain("its last 200 changes, each for at most 180 days");
    expect(privacy).toContain('with "deleted user" and removes your osu! ID');
  });

  it("says map covers and preview clips load straight from osu!'s servers", () => {
    expect(read("privacy")).toContain("straight from osu!'s servers (assets.ppy.sh and b.ppy.sh)");
  });

  it("dates the privacy page, disclaimers page and terms from their last change", () => {
    expect(updated("privacy")).toBe("2026-10-05");
    expect(updated("disclaimers")).toBe("2026-10-05");
    expect(updated("terms")).toBe("2026-10-05");
  });

  it("says what similar maps are and that the mirror is asked for them", () => {
    const disclaimers = read("disclaimers");
    expect(disclaimers).toContain("Similar maps are a guide.");
    expect(disclaimers).toContain("for map details when someone asks for similar maps");
  });

  it("the your-privacy-rights page names the GDPR and CCPA and points back to privacy", () => {
    const rights = read("your-privacy-rights");
    expect(rights).toContain("GDPR");
    expect(rights).toContain("CCPA");
    expect(rights).toContain("/legal/privacy");
  });

  it("the copyright page covers the DMCA, pool sources, and that pools never hosts beatmap files", () => {
    const copyright = read("copyright");
    expect(copyright).toContain("pools never hosts beatmap files");
    expect(copyright).toContain("otdb");
    expect(copyright).toContain("mirror.hinamizawa.ai");
  });

  it.each(LEGAL_SLUGS)("%s has no em dash", (slug) => {
    expect(read(slug)).not.toContain("—");
  });
});
