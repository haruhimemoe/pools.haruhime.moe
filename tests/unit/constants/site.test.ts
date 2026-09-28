/**
 * @file tests/unit/constants/site.test.ts
 * @desc The server's User-Agent is a header both clients take: @haruhimemoe/osu 0.3 refuses one
 *       that isn't printable ASCII, and @haruhimemoe/hinai 0.3 one that isn't a header value.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { createHinaiClient } from "@haruhimemoe/hinai";
import { createOsuClient } from "@haruhimemoe/osu";
import { describe, expect, it } from "vitest";
import { SERVER_USER_AGENT } from "@/constants/site";

describe("SERVER_USER_AGENT", () => {
  it("is printable ASCII", () => {
    expect(SERVER_USER_AGENT).toMatch(/^[\x20-\x7e]+$/);
  });

  it("is taken by the osu! and mirror clients", () => {
    const credentials = () => ({ clientId: "1", clientSecret: "x" });
    expect(() => createOsuClient({ userAgent: SERVER_USER_AGENT, credentials })).not.toThrow();
    expect(() => createHinaiClient({ userAgent: SERVER_USER_AGENT })).not.toThrow();
  });
});
