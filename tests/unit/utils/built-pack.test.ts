/**
 * @file tests/unit/utils/built-pack.test.ts
 * @desc A built pool's pack: the description crediting its owner and editors with a link back
 *       (within packs' 500 characters, names the content filter refuses left out), the input
 *       packs gets (public only for a public pool that isn't hidden), when a pool is due a sync
 *       (unlisted or public, not removed by packs, pending or failed with a failure it tries
 *       again, 30 s since the last try), the state each answer leaves (a refusal isn't tried
 *       again by itself), and what the browser sees (a link as long as there's a pack).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  builtPackDescription,
  builtPackInput,
  clientPackOf,
  EMPTY_BUILT_PACK,
  nextBuiltPack,
  PACK_GONE,
  PACK_SYNC_INTERVAL_MS,
  PACKS_NOT_TAKING,
  packSyncDue,
  packWaiting,
} from "@/utils/built-pack";
import { makeBuiltPool } from "../../helpers/built-pools";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const URL = "https://pools.haruhime.moe/pools/b-a0000001";
const SLOTS = [{ mod: "NM", index: 1, beatmapId: 5 }];

describe("builtPackDescription", () => {
  it("credits the owner and editors and links the pool", () => {
    expect(builtPackDescription("b-a0000001", ["owner"])).toBe(
      `Built on pools.haruhime.moe by owner: ${URL}`,
    );
    expect(builtPackDescription("b-a0000001", ["owner", "a", "b"])).toBe(
      `Built on pools.haruhime.moe by owner, a and b: ${URL}`,
    );
    expect(builtPackDescription("b-a0000001", [])).toBe(`Built on pools.haruhime.moe: ${URL}`);
  });

  it("leaves out names the content filter refuses, and blank ones", () => {
    expect(builtPackDescription("b-a0000001", ["owner", "retard", " "])).toBe(
      `Built on pools.haruhime.moe by owner: ${URL}`,
    );
  });

  it("stays within packs' 500 characters, counting the rest", () => {
    const names = Array.from({ length: 11 }, (_, i) => `${i}`.padEnd(60, "x"));
    const text = builtPackDescription("b-a0000001", names);
    expect(text.length).toBeLessThanOrEqual(500);
    expect(text).toMatch(/ and \d+ more: https:\/\/pools\.haruhime\.moe\/pools\/b-a0000001$/);
  });
});

describe("builtPackInput", () => {
  it("sends the name, description, visibility, bare slots and buckets", () => {
    const buckets = [{ code: "NM" as const }, { code: "TB" as const }];
    const pool = makeBuiltPool({ visibility: "public", slots: SLOTS, buckets });
    expect(builtPackInput(pool, ["owner"])).toEqual({
      name: "Spring Cup Finals",
      description: `Built on pools.haruhime.moe by owner: ${URL}`,
      visibility: "public",
      slots: SLOTS,
      buckets,
    });
  });

  it("sends unlisted for an unlisted pool and a hidden public one, no buckets by default", () => {
    const unlisted = builtPackInput(makeBuiltPool({ visibility: "unlisted", slots: SLOTS }), []);
    expect(unlisted.visibility).toBe("unlisted");
    expect(unlisted).not.toHaveProperty("buckets");
    const hidden = makeBuiltPool({ visibility: "public", hidden: true, slots: SLOTS });
    expect(builtPackInput(hidden, []).visibility).toBe("unlisted");
  });
});

describe("packSyncDue", () => {
  const pending = { ...EMPTY_BUILT_PACK, state: "pending" as const };
  const pool = (over = {}) => ({ visibility: "public" as const, pack: { ...pending, ...over } });

  it("is due for a pending or failed shared pool never tried or tried 30 s ago", () => {
    expect(packSyncDue(pool(), NOW)).toBe(true);
    expect(packSyncDue(pool({ state: "failed" }), NOW)).toBe(true);
    const tried = new Date(NOW.getTime() - PACK_SYNC_INTERVAL_MS);
    expect(packSyncDue(pool({ lastAttemptAt: tried }), NOW)).toBe(true);
  });

  it("waits inside the window, and never syncs private, synced, none or removed", () => {
    const recent = new Date(NOW.getTime() - PACK_SYNC_INTERVAL_MS + 1);
    expect(packSyncDue(pool({ lastAttemptAt: recent }), NOW)).toBe(false);
    expect(packSyncDue({ ...pool(), visibility: "private" }, NOW)).toBe(false);
    expect(packSyncDue(pool({ state: "synced" }), NOW)).toBe(false);
    expect(packSyncDue(pool({ state: "none" }), NOW)).toBe(false);
    expect(packSyncDue(pool({ state: "failed", gone: true }), NOW)).toBe(false);
  });

  it("leaves a refusal for the next change or Update pack now", () => {
    expect(packSyncDue(pool({ state: "failed", retry: false }), NOW)).toBe(false);
    expect(packSyncDue(pool({ state: "pending", retry: false }), NOW)).toBe(true);
  });
});

describe("nextBuiltPack", () => {
  const previous = { ...EMPTY_BUILT_PACK, state: "pending" as const, lastAttemptAt: NOW };

  it("is synced after created, updated or unchanged", () => {
    for (const state of ["created", "updated", "unchanged"] as const) {
      const answer = { kind: "ok" as const, slug: "Abc123", state, listed: true };
      expect(nextBuiltPack(previous, answer, NOW)).toEqual({
        state: "synced",
        slug: "Abc123",
        syncedAt: NOW,
        error: null,
        lastAttemptAt: NOW,
        listed: true,
        gone: false,
        retry: true,
      });
    }
  });

  it("is failed with the reason otherwise, and gone for good after a 410", () => {
    const rejected = { kind: "rejected" as const, status: 400, message: "Too long." };
    expect(nextBuiltPack(previous, rejected, NOW)).toMatchObject({
      state: "failed",
      error: "packs refused it (400): Too long.",
      gone: false,
      retry: false,
    });
    const down = { kind: "error" as const, message: "packs answered 503.", retryAfterMs: null };
    expect(nextBuiltPack(previous, down, NOW)).toMatchObject({
      state: "failed",
      error: "packs answered 503.",
      retry: true,
    });
    // A settings problem is ours to fix: builders get a plain reason, never the setting's name.
    const config = { kind: "config" as const, message: "Check POOLS_SERVICE_TOKEN in both apps." };
    expect(nextBuiltPack(previous, config, NOW)).toMatchObject({
      error: PACKS_NOT_TAKING,
      retry: false,
    });
    expect(nextBuiltPack(previous, { kind: "gone" }, NOW)).toMatchObject({
      state: "failed",
      error: PACK_GONE,
      listed: false,
      gone: true,
    });
  });
});

describe("clientPackOf", () => {
  const synced = { ...EMPTY_BUILT_PACK, state: "synced" as const, slug: "Abc123" };
  const shared = (over = {}) =>
    makeBuiltPool({
      visibility: "public",
      slots: SLOTS,
      pack: { ...synced, listed: true, ...over },
    });

  it("links a public pool's pack page while packs lists it, and the pack key otherwise", () => {
    const key = /^https:\/\/packs\.haruhime\.moe\/k#pk\d\./;
    expect(clientPackOf(shared())).toEqual({
      state: "synced",
      href: "https://packs.haruhime.moe/p/Abc123",
      error: null,
      gone: false,
      retry: true,
    });
    // An unlisted pool's pack has no page anyone can open: the key works for everyone.
    const unlisted = makeBuiltPool({ visibility: "unlisted", slots: SLOTS, pack: synced });
    expect(clientPackOf(unlisted).href).toMatch(key);
    // A public pool our moderators hid is unlisted on packs too.
    const hidden = makeBuiltPool({
      visibility: "public",
      hidden: true,
      slots: SLOTS,
      pack: synced,
    });
    expect(clientPackOf(hidden).href).toMatch(key);
    // A public pool packs doesn't list: packs' moderators hid it, so its page is closed.
    expect(clientPackOf(shared({ listed: false })).href).toMatch(key);
  });

  it("keeps a link while there's a pack, the reason when failed, and none for private", () => {
    const failed = shared({ state: "failed", error: "packs answered 503." });
    expect(clientPackOf(failed)).toMatchObject({ href: null, error: "packs answered 503." });
    // Only the owner and editors get packs' reason; anyone else sees the state alone.
    expect(clientPackOf(failed, { withError: false }).error).toBeNull();
    // A change waiting for the next sync: packs' page is still there.
    expect(clientPackOf(shared({ state: "pending" }))).toMatchObject({
      href: "https://packs.haruhime.moe/p/Abc123",
      error: null,
    });
    const first = shared({ state: "pending", slug: null, listed: false });
    expect(clientPackOf(first).href).toMatch(/\/k#/);
    const private_ = makeBuiltPool({ pack: { ...synced, state: "pending" } });
    expect(clientPackOf(private_).state).toBe("none");
  });

  it("gives an unlisted pool's key in every state but none, and nothing once packs removed it", () => {
    const unlisted = (over = {}) =>
      makeBuiltPool({ visibility: "unlisted", slots: SLOTS, pack: { ...synced, ...over } });
    for (const state of ["pending", "failed"] as const) {
      expect(clientPackOf(unlisted({ state, slug: null })).href).toMatch(/\/k#/);
    }
    expect(clientPackOf(unlisted({ state: "none", slug: null })).href).toBeNull();
    expect(clientPackOf(unlisted({ state: "failed", gone: true })).href).toBeNull();
  });
});

describe("packWaiting", () => {
  const pack = (over = {}) => ({
    state: "pending" as const,
    href: null,
    error: null,
    gone: false,
    retry: true,
    ...over,
  });

  it("waits while pending, or failed with a failure pools tries again", () => {
    expect(packWaiting(pack())).toBe(true);
    expect(packWaiting(pack({ state: "failed" }))).toBe(true);
    expect(packWaiting(pack({ state: "failed", retry: false }))).toBe(false);
    expect(packWaiting(pack({ state: "failed", gone: true }))).toBe(false);
    expect(packWaiting(pack({ state: "synced" }))).toBe(false);
  });
});
