/**
 * @file tests/setup/integration.ts
 * @desc Per-file setup for the integration project: a full fake server env pointing at the
 *       in-memory MongoDB, revalidation calls recorded instead of run, and `after` tasks kept
 *       for the test to run.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Oct 3, 2026
 */

import { stubOsuAppEnv } from "@haruhimemoe/next-kit/testing";
import { beforeEach, inject, vi } from "vitest";
import { clearAfterTasks } from "../helpers/after";

// TEMP(next-kit link): next-kit is linked via file:../next-kit and carries its own vitest, so its
// ProvidedContext augmentation lands on another module instance. Repeating it keeps
// inject("mongoUri") typed. Drop once next-kit is a registry dependency again.
declare module "vitest" {
  interface ProvidedContext {
    mongoUri: string;
  }
}

stubOsuAppEnv({ MONGODB_URI: inject("mongoUri") });
// CI sets SKIP_ENV_VALIDATION for the whole job (for `next build`); integration tests use a real
// in-memory database, so services must not take their "no database" path.
vi.stubEnv("SKIP_ENV_VALIDATION", "");

// revalidatePath needs Next's request store; tests assert the calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// `after` needs Next's request scope too: its tasks are kept for tests to run (helpers/after.ts).
vi.mock("next/server", async (importOriginal) => {
  const { recordAfter } = await import("../helpers/after");
  return { ...(await importOriginal<typeof import("next/server")>()), after: recordAfter };
});
beforeEach(clearAfterTasks);
