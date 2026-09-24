/**
 * @file src/instrumentation.ts
 * @desc Runs once when a server instance starts (Node.js runtime only): refuses to start a
 *       production server whose SKIP_ENV_VALIDATION would swap a secret for its public
 *       placeholder. `next build` and dev are untouched.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/**
 * @function register
 * @returns {Promise<void>} resolves when the environment is safe to serve with
 * @throws {EnvError} (rejects) naming each secret that would be a placeholder
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertNoPlaceholderSecrets } = await import("@/env");
  assertNoPlaceholderSecrets(process.env);
}
