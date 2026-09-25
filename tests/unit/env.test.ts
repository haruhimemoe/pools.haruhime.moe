/**
 * @file tests/unit/env.test.ts
 * @desc Server env parsing: valid input, missing and invalid names (never values), blanks, the CI
 *       SKIP_ENV_VALIDATION escape hatch and its production guard (VERCEL_ENV decides on Vercel).
 *       The optional variables are read on every call by their own getters: ADMIN_OSU_IDS (the
 *       admins), PACKS_URL and POOLS_SERVICE_TOKEN (the packs service), and a bad value only
 *       breaks what uses it. POOLS_ALLOW_SHARED_DB_USER is on only for "true".
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Fri Sep 25, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertNoPlaceholderSecrets,
  DEFAULT_PACKS_URL,
  EnvError,
  getAdminOsuIds,
  getAllowSharedDbUser,
  getPacksService,
  isEnvValidationSkipped,
  OPTIONAL_ENV_KEYS,
  parseDatabaseEnv,
  parseServerEnv,
  SERVER_ENV_KEYS,
} from "@/env";
import { TEST_SERVER_ENV } from "../helpers/server-env";

afterEach(() => {
  vi.unstubAllEnvs();
});

const errorFrom = (source: Record<string, string | undefined>): Error => {
  try {
    parseServerEnv(source);
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected parseServerEnv to throw");
};

const invalid = (key: string) =>
  new EnvError(`Missing or invalid environment variables: ${key}. See .env.example.`);

describe("parseServerEnv", () => {
  it("returns exactly the server variables", () => {
    expect(parseServerEnv({ ...TEST_SERVER_ENV, UNRELATED: "x" })).toEqual(TEST_SERVER_ENV);
  });

  it("names every missing variable, in schema order", () => {
    const error = errorFrom({});
    expect(error).toBeInstanceOf(EnvError);
    expect(error.message).toBe(
      `Missing or invalid environment variables: ${SERVER_ENV_KEYS.join(", ")}. See .env.example.`,
    );
  });

  it("never puts a value in the error message", () => {
    const error = errorFrom({ ...TEST_SERVER_ENV, BETTER_AUTH_SECRET: "short-secret-value" });
    expect(error.message).toContain("BETTER_AUTH_SECRET");
    expect(error.message).not.toContain("short-secret-value");
  });

  it("treats blank values as missing", () => {
    expect(errorFrom({ ...TEST_SERVER_ENV, OSU_CLIENT_SECRET: "   " }).message).toContain(
      "OSU_CLIENT_SECRET",
    );
  });

  it("rejects a URI that isn't MongoDB and a client id that isn't a number", () => {
    expect(errorFrom({ ...TEST_SERVER_ENV, MONGODB_URI: "postgres://x" }).message).toContain(
      "MONGODB_URI",
    );
    expect(errorFrom({ ...TEST_SERVER_ENV, OSU_CLIENT_ID: "abc" }).message).toContain(
      "OSU_CLIENT_ID",
    );
  });

  it("keeps the optional variables out, so a bad one can't break the rest", () => {
    for (const key of OPTIONAL_ENV_KEYS) expect(SERVER_ENV_KEYS).not.toContain(key);
    expect(
      parseServerEnv({ ...TEST_SERVER_ENV, ADMIN_OSU_IDS: "nope", POOLS_SERVICE_TOKEN: "short" }),
    ).toEqual(TEST_SERVER_ENV);
  });

  it("fills placeholders under SKIP_ENV_VALIDATION but keeps real values", () => {
    const env = parseServerEnv({ SKIP_ENV_VALIDATION: "true", OSU_CLIENT_ID: "42" });
    expect(env.OSU_CLIENT_ID).toBe("42");
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.MONGODB_URI).toMatch(/^mongodb:\/\//);
  });
});

describe("parseDatabaseEnv", () => {
  it("needs only MONGODB_URI", () => {
    expect(parseDatabaseEnv({ MONGODB_URI: " mongodb://db.example:27017 " })).toEqual({
      MONGODB_URI: "mongodb://db.example:27017",
    });
  });

  it("names MONGODB_URI when it's missing or wrong, never printing it", () => {
    for (const value of [undefined, "  ", "postgres://secret@x"]) {
      expect(() => parseDatabaseEnv({ MONGODB_URI: value })).toThrow(invalid("MONGODB_URI"));
    }
  });
});

describe("SKIP_ENV_VALIDATION on a production server", () => {
  const SKIP_IN_PROD = { SKIP_ENV_VALIDATION: "true", NODE_ENV: "production" };

  it("throws, naming every secret that would be a placeholder", () => {
    expect(() => assertNoPlaceholderSecrets(SKIP_IN_PROD)).toThrow(
      "SKIP_ENV_VALIDATION is set on a production server, so BETTER_AUTH_SECRET, OSU_CLIENT_SECRET, MONGODB_URI would fall back to public placeholders. Set the real values and unset SKIP_ENV_VALIDATION.",
    );
    expect(() => parseDatabaseEnv(SKIP_IN_PROD)).toThrow("MONGODB_URI");
  });

  it("allows it during next build, outside production, and on Vercel Preview", () => {
    expect(() =>
      parseServerEnv({ ...SKIP_IN_PROD, NEXT_PHASE: "phase-production-build" }),
    ).not.toThrow();
    expect(() => parseServerEnv({ SKIP_ENV_VALIDATION: "true", NODE_ENV: "test" })).not.toThrow();
    expect(() =>
      assertNoPlaceholderSecrets({ ...SKIP_IN_PROD, VERCEL_ENV: "preview" }),
    ).not.toThrow();
  });

  it("throws on VERCEL_ENV=production", () => {
    expect(() => assertNoPlaceholderSecrets({ ...SKIP_IN_PROD, VERCEL_ENV: "production" })).toThrow(
      EnvError,
    );
  });

  it("allows it with every real secret set", () => {
    const real = { ...TEST_SERVER_ENV, MONGODB_URI: "mongodb://db.example:27017" };
    expect(parseServerEnv({ ...real, ...SKIP_IN_PROD })).toEqual(real);
  });
});

describe("isEnvValidationSkipped", () => {
  it("is true only for SKIP_ENV_VALIDATION=true", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    expect(isEnvValidationSkipped()).toBe(true);
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    expect(isEnvValidationSkipped()).toBe(false);
  });
});

describe("getAdminOsuIds", () => {
  it("is empty when unset or blank", () => {
    vi.stubEnv("ADMIN_OSU_IDS", "");
    expect(getAdminOsuIds().size).toBe(0);
    vi.stubEnv("ADMIN_OSU_IDS", "   ");
    expect(getAdminOsuIds().size).toBe(0);
  });

  it("reads ids separated by commas and spaces, fresh on every call", () => {
    vi.stubEnv("ADMIN_OSU_IDS", "12231334, 2");
    expect([...getAdminOsuIds()]).toEqual([12231334, 2]);
    vi.stubEnv("ADMIN_OSU_IDS", "7");
    expect([...getAdminOsuIds()]).toEqual([7]);
  });

  it.each(["abc", "1,,2", "1;2", "12231334,"])("refuses %j without printing it", (value) => {
    vi.stubEnv("ADMIN_OSU_IDS", value);
    expect(() => getAdminOsuIds()).toThrow(invalid("ADMIN_OSU_IDS"));
  });
});

describe("getPacksService", () => {
  const TOKEN = "t".repeat(40);

  it("is null while POOLS_SERVICE_TOKEN isn't set", () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    expect(getPacksService()).toBeNull();
  });

  it("defaults PACKS_URL to packs.haruhime.moe", () => {
    vi.stubEnv("PACKS_URL", "");
    vi.stubEnv("POOLS_SERVICE_TOKEN", ` ${TOKEN} `);
    expect(getPacksService()).toEqual({ url: DEFAULT_PACKS_URL, token: TOKEN });
  });

  it("takes an https origin, or plain http on localhost", () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", TOKEN);
    vi.stubEnv("PACKS_URL", "https://packs.example.com/");
    expect(getPacksService()?.url).toBe("https://packs.example.com");
    vi.stubEnv("PACKS_URL", "http://localhost:3001");
    expect(getPacksService()?.url).toBe("http://localhost:3001");
  });

  it.each([
    "http://packs.example.com",
    "ftp://packs.example.com",
    "not a url",
    "https://x.dev/api",
  ])("refuses PACKS_URL %j", (value) => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", TOKEN);
    vi.stubEnv("PACKS_URL", value);
    expect(() => getPacksService()).toThrow(invalid("PACKS_URL"));
  });

  it("refuses a token under 32 characters without printing it", () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "short-token");
    expect(() => getPacksService()).toThrow(invalid("POOLS_SERVICE_TOKEN"));
  });
});

describe("getAllowSharedDbUser", () => {
  it("is off when unset or blank", () => {
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", undefined);
    expect(getAllowSharedDbUser()).toBe(false);
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", "");
    expect(getAllowSharedDbUser()).toBe(false);
  });

  it("is on for true (around spaces), read fresh on every call", () => {
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", "true");
    expect(getAllowSharedDbUser()).toBe(true);
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", " true\n");
    expect(getAllowSharedDbUser()).toBe(true);
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", "");
    expect(getAllowSharedDbUser()).toBe(false);
  });

  it.each(["TRUE", "True", "1", "yes", "on", "false", "truee"])("is off for %j", (value) => {
    vi.stubEnv("POOLS_ALLOW_SHARED_DB_USER", value);
    expect(getAllowSharedDbUser()).toBe(false);
  });
});
