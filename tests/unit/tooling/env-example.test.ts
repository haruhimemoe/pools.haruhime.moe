/**
 * @file tests/unit/tooling/env-example.test.ts
 * @desc .env.example documents every server variable and every optional one, and ships no secret
 *       values. A copy of it starts with the strict database check and no beta tag.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OPTIONAL_ENV_KEYS, SERVER_ENV_KEYS } from "@/env";

const text = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");

describe(".env.example", () => {
  it.each([...SERVER_ENV_KEYS, ...OPTIONAL_ENV_KEYS])("documents %s", (key) => {
    expect(text).toMatch(new RegExp(`^${key}=`, "m"));
  });

  it.each(["MONGODB_URI", "BETTER_AUTH_SECRET", "OSU_CLIENT_SECRET", "POOLS_SERVICE_TOKEN"])(
    "leaves %s empty",
    (key) => {
      expect(text).toMatch(new RegExp(`^${key}=$`, "m"));
    },
  );

  it("leaves POOLS_ALLOW_SHARED_DB_USER empty, so a copy keeps the strict database check", () => {
    expect(text).toMatch(/^POOLS_ALLOW_SHARED_DB_USER=$/m);
  });
});
