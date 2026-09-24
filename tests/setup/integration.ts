/**
 * @file tests/setup/integration.ts
 * @desc Per-file setup for the integration project: a full fake server env pointing at the
 *       in-memory MongoDB, and revalidation calls recorded instead of run.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { inject, vi } from "vitest";
import { stubServerEnv } from "../helpers/server-env";

stubServerEnv({ MONGODB_URI: inject("mongoUri") });
// CI sets SKIP_ENV_VALIDATION for the whole job (for `next build`); integration tests use a real
// in-memory database, so services must not take their "no database" path.
vi.stubEnv("SKIP_ENV_VALIDATION", "");

// revalidatePath needs Next's request store; tests assert the calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
