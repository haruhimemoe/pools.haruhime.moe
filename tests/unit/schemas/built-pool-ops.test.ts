/**
 * @file tests/unit/schemas/built-pool-ops.test.ts
 * @desc The pool routes' bodies, all strict: a create (a name and details, or a pool to start
 *       from, with a template's targets), an ops call (a base version and 1 to 20 ops, each op's own fields checked and
 *       text through the content filter), a visibility, and an editor's osu! username.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  createPoolBodySchema,
  editorBodySchema,
  opsBodySchema,
  visibilityBodySchema,
} from "@/schemas/built-pool-ops";

const ok = (op: Record<string, unknown>) =>
  opsBodySchema.safeParse({ baseVersion: 1, ops: [op] }).success;

describe("createPoolBodySchema", () => {
  it("takes a name and details, or a pool to start from", () => {
    expect(createPoolBodySchema.parse({ name: " Cup ", year: 2024 })).toEqual({
      name: "Cup",
      year: 2024,
    });
    expect(createPoolBodySchema.parse({ startedFrom: "otdb-12" })).toEqual({
      startedFrom: "otdb-12",
    });
    expect(createPoolBodySchema.parse({ name: "Cup", template: "finals" })).toEqual({
      name: "Cup",
      template: "finals",
    });
  });

  it.each([
    {},
    { name: "" },
    { name: "Cup", extra: 1 },
    { startedFrom: "Bad Id" },
    { name: "fags" },
    { name: "Cup", template: "semis" },
  ])("refuses %j", (body) => {
    expect(createPoolBodySchema.safeParse(body).success).toBe(false);
  });
});

describe("opsBodySchema", () => {
  it.each([
    { type: "setDetails", name: "New name", year: null },
    { type: "addMap", beatmapId: 129891, bucket: "NM" },
    { type: "addMap", beatmapId: 129891, bucket: null, index: 3 },
    { type: "removeMap", slot: { bucket: "HD", index: 1 } },
    { type: "moveMap", slot: { bucket: "HD", index: 1 }, bucket: "DT", index: 2 },
    { type: "setSlotMods", bucket: "EZ", mods: { kind: "forced", set: ["EZ", "HD"] } },
    { type: "setSlotMods", bucket: "EZ", mods: { kind: "free" } },
    { type: "addBucket", code: "EZ" },
    { type: "addBucket", code: "Speed", color: 3, mods: { kind: "none" } },
    { type: "removeBucket", code: "EZ" },
    { type: "replaceMaps", text: "NM1 129891" },
    { type: "replaceMaps", text: "129891", mode: "merge" },
    { type: "setTarget", bucket: "NM", count: 5 },
    { type: "setTarget", bucket: "HD", count: 0, sr: { min: 5.8, max: 6.3 } },
    { type: "setTarget", bucket: "EZ", count: 16, sr: { min: 6, max: 6 } },
  ])("takes %j", (op) => {
    expect(ok(op)).toBe(true);
  });

  it.each([
    { type: "setDetails" },
    { type: "setDetails", name: "retards" },
    { type: "addMap", beatmapId: 0, bucket: "NM" },
    { type: "addMap", beatmapId: 1, bucket: "NM", index: 100 },
    { type: "addMap", beatmapId: 1, bucket: "N M" },
    { type: "removeMap", slot: { bucket: "HD" } },
    { type: "setSlotMods", bucket: "EZ", mods: { kind: "forced", set: ["XX"] } },
    { type: "addBucket", code: "chink" },
    { type: "addBucket", code: "EZ", color: 10 },
    { type: "replaceMaps", text: "x".repeat(16_001) },
    { type: "replaceMaps", text: "1", mode: "append" },
    { type: "renameBucket", code: "EZ" },
    { type: "addMap", beatmapId: 1, bucket: "NM", extra: true },
    { type: "setTarget", bucket: "NM", count: 17 },
    { type: "setTarget", bucket: "NM", count: -1 },
    { type: "setTarget", bucket: "NM", count: 2.5 },
    { type: "setTarget", bucket: "NM" },
    { type: "setTarget", bucket: "NM", count: 2, sr: { min: 7, max: 6 } },
    { type: "setTarget", bucket: "NM", count: 2, sr: { min: 1, max: 10.5 } },
    { type: "setTarget", bucket: "NM", count: 2, sr: { min: 1 } },
    { type: "setTarget", bucket: "NM", count: 2, sr: null },
    { type: "setTarget", bucket: "chink", count: 2 },
  ])("refuses %j", (op) => {
    expect(ok(op)).toBe(false);
  });

  it("wants a base version and 1 to 20 ops", () => {
    const op = { type: "addBucket", code: "EZ" };
    expect(opsBodySchema.safeParse({ baseVersion: 1, ops: [] }).success).toBe(false);
    expect(opsBodySchema.safeParse({ baseVersion: 0, ops: [op] }).success).toBe(false);
    expect(opsBodySchema.safeParse({ ops: [op] }).success).toBe(false);
    const twenty = Array.from({ length: 20 }, () => op);
    expect(opsBodySchema.safeParse({ baseVersion: 3, ops: twenty }).success).toBe(true);
    expect(opsBodySchema.safeParse({ baseVersion: 3, ops: [...twenty, op] }).success).toBe(false);
  });
});

describe("visibility and editor bodies", () => {
  it("takes a visibility", () => {
    expect(visibilityBodySchema.parse({ visibility: "unlisted" })).toEqual({
      visibility: "unlisted",
    });
    expect(visibilityBodySchema.safeParse({ visibility: "hidden" }).success).toBe(false);
  });

  it("takes an osu! username", () => {
    expect(editorBodySchema.parse({ username: " Mr [Bot]_-1 " })).toEqual({
      username: "Mr [Bot]_-1",
    });
    for (const username of ["", "a/b", "x".repeat(33), "na\nme"]) {
      expect(editorBodySchema.safeParse({ username }).success).toBe(false);
    }
  });
});
