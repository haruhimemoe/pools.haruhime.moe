/**
 * @file tests/setup/integration-global.ts
 * @desc The integration project's globalSetup: next-kit's startMemoryMongo, one in-memory
 *       MongoDB for the run, its URI handed to the workers as inject("mongoUri"). Vitest needs a
 *       file with a default export here, so this is the only line.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

export { startMemoryMongo as default } from "@haruhimemoe/next-kit/testing";
