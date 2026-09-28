/**
 * @file tests/unit/app/security-txt.test.ts
 * @desc /.well-known/security.txt: GitHub private vulnerability reporting, then the email, as
 *       contacts; pools' canonical URL and policy; and an Expires under a year out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { GET } from "@/app/.well-known/security.txt/route";

describe("GET /.well-known/security.txt", () => {
  it("names pools' contact, canonical URL and policy", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const body = await response.text();
    expect(body.split("\n").slice(0, 2)).toEqual([
      "Contact: https://github.com/haruhimemoe/pools.haruhime.moe/security/advisories/new",
      "Contact: mailto:contact@haruhime.moe",
    ]);
    expect(body).toContain("Canonical: https://pools.haruhime.moe/.well-known/security.txt\n");
    expect(body).toContain(
      "Policy: https://github.com/haruhimemoe/pools.haruhime.moe/blob/main/SECURITY.md\n",
    );
    const expires = /^Expires: (.+)$/m.exec(body)?.[1] ?? "";
    expect(new Date(expires).getTime() - Date.now()).toBeLessThanOrEqual(365 * 86_400_000);
  });
});
