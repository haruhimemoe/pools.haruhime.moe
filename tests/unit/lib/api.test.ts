/**
 * @file tests/unit/lib/api.test.ts
 * @desc JSON errors ({ error: { code, message } }), body parsing (JSON only, 16 KB or a cap the
 *       route gives, like the 32 KB of the pool routes, schema
 *       errors as 400 with the first message, and the code a refinement names in its params, like
 *       the content filter's), no-store, and the same-origin guard (a foreign
 *       Origin or a cross-site or same-site Sec-Fetch-Site is refused; our own origin, previews
 *       and server calls pass), and the /check ids parser (1 to 64 valid beatmap ids, or null).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CROSS_SITE_REFUSED,
  jsonError,
  noStore,
  parseBeatmapIds,
  parseJsonBody,
  refuseCrossSite,
} from "@/lib/api";

const post = (
  body: string,
  headers: Record<string, string> = { "content-type": "application/json" },
) => new Request("https://pools.haruhime.moe/api/admin/x", { method: "POST", headers, body });

describe("jsonError and noStore", () => {
  it("answers { error: { code, message } } with the status's code", async () => {
    const response = noStore(jsonError(503, "Try again."));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "unavailable", message: "Try again." },
    });
    expect(await jsonError(418, "x").json()).toEqual({
      error: { code: "bad_request", message: "x" },
    });
  });
});

describe("parseJsonBody", () => {
  const schema = z.strictObject({ hidden: z.boolean() });

  it("reads a valid body", async () => {
    expect(await parseJsonBody(post('{"hidden":true}'), schema)).toEqual({
      ok: true,
      data: { hidden: true },
    });
  });

  it.each([
    [post('{"hidden":true}', { "content-type": "text/plain" }), 415],
    [post("x".repeat(20_000)), 413],
    [post("{nope"), 400],
    [post('{"hidden":"yes"}'), 400],
    [post('{"hidden":true,"extra":1}'), 400],
  ])("refuses a bad body (%#)", async (request, status) => {
    const result = await parseJsonBody(request, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(status);
  });

  it("sends the code a refinement names in its params", async () => {
    const named = z.strictObject({
      name: z.string().refine((text) => text !== "bad", {
        message: "That fails the content filter.",
        params: { code: "content_filter" },
      }),
    });
    const result = await parseJsonBody(post('{"name":"bad"}'), named);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(await result.response.json()).toEqual({
        error: { code: "content_filter", message: "That fails the content filter." },
      });
    }
    const plain = await parseJsonBody(post('{"hidden":"yes"}'), schema);
    if (!plain.ok)
      expect(await plain.response.json()).toMatchObject({ error: { code: "bad_request" } });
  });

  it("takes a route's own cap", async () => {
    const body = JSON.stringify({ hidden: true, pad: "x".repeat(20_000) });
    const loose = z.object({ hidden: z.boolean() });
    expect((await parseJsonBody(post(body), loose, { maxBytes: 32_768 })).ok).toBe(true);
    const tooBig = JSON.stringify({ hidden: true, pad: "x".repeat(33_000) });
    const result = await parseJsonBody(post(tooBig), loose, { maxBytes: 32_768 });
    expect(result.ok ? 200 : result.response.status).toBe(413);
  });
});

describe("refuseCrossSite", () => {
  const request = (
    headers: Record<string, string>,
    url = "https://pools.haruhime.moe/api/admin/x",
  ) => new Request(url, { method: "POST", headers });

  it.each([
    [{ origin: "https://evil.example" }],
    [{ origin: "https://packs.haruhime.moe" }],
    [{ "sec-fetch-site": "cross-site" }],
    [{ "sec-fetch-site": "same-site" }],
  ])("refuses %j", async (headers) => {
    const response = refuseCrossSite(request(headers));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({
      error: { code: "forbidden", message: CROSS_SITE_REFUSED },
    });
  });

  it.each([
    [{}],
    [{ origin: "https://pools.haruhime.moe", "sec-fetch-site": "same-origin" }],
    [{ "sec-fetch-site": "none" }],
  ])("lets %j through", (headers) => {
    expect(refuseCrossSite(request(headers))).toBeNull();
  });

  it("lets a preview deployment call itself", () => {
    const url = "https://pools-git-x.vercel.app/api/admin/x";
    expect(refuseCrossSite(request({ origin: "https://pools-git-x.vercel.app" }, url))).toBeNull();
  });
});

describe("parseBeatmapIds", () => {
  it("reads 1 to 64 beatmap ids", () => {
    expect(parseBeatmapIds("75,129891")).toEqual([75, 129891]);
  });

  it.each([
    null,
    "",
    "abc",
    "0",
    "1,,2",
    "2147483648",
    Array.from({ length: 65 }, (_, i) => i + 1).join(","),
    "1".repeat(800),
  ])("refuses %j", (raw) => {
    expect(parseBeatmapIds(raw)).toBeNull();
  });
});
