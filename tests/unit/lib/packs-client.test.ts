/**
 * @file tests/unit/lib/packs-client.test.ts
 * @desc pools' calls to packs through msw: the PUT carries the token, JSON body and User-Agent;
 *       every answer lands in the right class (ok, config for 401 and 503 not_configured in
 *       either error body shape, gone for 410, error for 429/5xx/HTML/network with Retry-After,
 *       rejected with packs' message for other 4xx, error for a 2xx it can't read); the stats
 *       call the same way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { SERVER_USER_AGENT } from "@/constants/site";
import { postStatsBackfill, putPoolPack } from "@/lib/packs-client";
import type { PackInput } from "@/utils/pack-input";
import { setupMsw } from "../../helpers/msw";
import {
  PACKS_URL_FOR_TESTS,
  type PutCall,
  packsPutHandler,
  TEST_SERVICE,
} from "../../helpers/packs-server";

const server = setupMsw();

const INPUT: PackInput = {
  name: "osu! World Cup 2023 Grand Finals",
  description:
    "osu! World Cup Grand Finals (2023). Pool details and sources: https://pools.haruhime.moe/pools/otdb-657",
  visibility: "public",
  slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
};

const answerWith = (response: () => Response) => {
  server.use(packsPutHandler(() => response()));
  return putPoolPack(TEST_SERVICE, "otdb-657", INPUT);
};

describe("putPoolPack", () => {
  it("sends the token, the JSON body and our User-Agent, and reads a created answer", async () => {
    const calls: PutCall[] = [];
    server.use(
      packsPutHandler(
        () =>
          HttpResponse.json(
            { slug: "Ab3_x-9QzP", state: "created", listed: true },
            { status: 201 },
          ),
        calls,
      ),
    );
    expect(await putPoolPack(TEST_SERVICE, "otdb-657", INPUT)).toEqual({
      kind: "ok",
      slug: "Ab3_x-9QzP",
      state: "created",
      listed: true,
    });
    expect(calls).toEqual([
      {
        id: "otdb-657",
        body: INPUT,
        authorization: `Bearer ${TEST_SERVICE.token}`,
        userAgent: SERVER_USER_AGENT,
      },
    ]);
  });

  it("reads updated and unchanged answers, unlisted ones included", async () => {
    expect(
      await answerWith(() =>
        HttpResponse.json({ slug: "Ab3_x-9QzP", state: "unchanged", listed: false }),
      ),
    ).toEqual({ kind: "ok", slug: "Ab3_x-9QzP", state: "unchanged", listed: false });
  });

  it.each([
    [
      "401",
      () =>
        HttpResponse.json(
          { error: { code: "unauthorized", message: "Not authorized." } },
          { status: 401 },
        ),
    ],
    [
      "503 not_configured",
      () => HttpResponse.json({ error: { code: "not_configured", message: "x" } }, { status: 503 }),
    ],
    [
      "503 not_configured (flat body)",
      () => HttpResponse.json({ code: "not_configured" }, { status: 503 }),
    ],
  ])("stops the sync on %s", async (_label, response) => {
    expect((await answerWith(response)).kind).toBe("config");
  });

  it.each([
    [
      "an error body",
      () => HttpResponse.json({ error: { code: "gone", message: "Deleted." } }, { status: 410 }),
    ],
    ["a flat body", () => HttpResponse.json({ code: "gone" }, { status: 410 })],
  ])("reads 410 with %s as gone", async (_label, response) => {
    expect(await answerWith(response)).toEqual({ kind: "gone" });
  });

  it("keeps packs' message on a rejection", async () => {
    expect(
      await answerWith(() =>
        HttpResponse.json(
          { error: { code: "bad_request", message: "Please keep the name free of slurs." } },
          { status: 400 },
        ),
      ),
    ).toEqual({ kind: "rejected", status: 400, message: "Please keep the name free of slurs." });
    expect(await answerWith(() => new HttpResponse("nope", { status: 422 }))).toEqual({
      kind: "rejected",
      status: 422,
      message: "packs answered 422.",
    });
  });

  it("reads 429 and 5xx as errors worth retrying, with Retry-After", async () => {
    expect(
      await answerWith(() =>
        HttpResponse.json(
          { error: { code: "rate_limited" } },
          { status: 429, headers: { "Retry-After": "5" } },
        ),
      ),
    ).toEqual({ kind: "error", message: "packs answered 429.", retryAfterMs: 5000 });
    expect(
      await answerWith(
        () =>
          new HttpResponse("<html>Bad Gateway</html>", {
            status: 502,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    ).toEqual({ kind: "error", message: "packs answered 502.", retryAfterMs: null });
    expect(
      await answerWith(() =>
        HttpResponse.json({ error: { code: "internal_error", message: "Oops." } }, { status: 500 }),
      ),
    ).toEqual({ kind: "error", message: "packs answered 500: Oops.", retryAfterMs: null });
    expect(
      await answerWith(() => HttpResponse.json({ code: "busy" }, { status: 503 })),
    ).toMatchObject({ kind: "error" });
  });

  it("reads a network failure and an unreadable 2xx as errors", async () => {
    expect(await answerWith(() => HttpResponse.error())).toMatchObject({
      kind: "error",
      message: expect.stringMatching(/^Couldn't reach packs: /),
    });
    expect(await answerWith(() => HttpResponse.json({ slug: "../x", state: "created" }))).toEqual({
      kind: "error",
      message: "packs answered 200 with a body pools can't read.",
      retryAfterMs: null,
    });
  });
});

describe("postStatsBackfill", () => {
  const stats = (response: () => Response) => {
    server.use(http.post(`${PACKS_URL_FOR_TESTS}/api/service/pools/stats`, () => response()));
    return postStatsBackfill(TEST_SERVICE);
  };

  it("reads one batch's counts", async () => {
    expect(await stats(() => HttpResponse.json({ updated: 3, remaining: 10 }))).toEqual({
      kind: "ok",
      updated: 3,
      remaining: 10,
    });
  });

  it("stops on configuration errors and reports the rest", async () => {
    expect((await stats(() => HttpResponse.json({}, { status: 401 }))).kind).toBe("config");
    expect(
      await stats(() => HttpResponse.json({ error: { message: "Oops." } }, { status: 500 })),
    ).toEqual({
      kind: "error",
      message: "packs answered 500: Oops.",
    });
    expect(await stats(() => HttpResponse.json({ updated: -1 }))).toEqual({
      kind: "error",
      message: "packs answered 200 with a body pools can't read.",
    });
  });
});
