/**
 * @file tests/helpers/after.ts
 * @desc Next.js `after` for integration tests (tests/setup/integration.ts mocks next/server with
 *       it): each task is kept instead of run, so a test runs them when it wants to
 *       (runAfterTasks) or checks how many were scheduled. Cleared before each test.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

const tasks: (() => unknown)[] = [];

/**
 * @function recordAfter
 * @param task {unknown} what `after` was given: a function or a promise
 * @returns {void} kept for runAfterTasks
 */
export const recordAfter = (task: unknown): void => {
  tasks.push(typeof task === "function" ? (task as () => unknown) : () => task);
};

/**
 * @function runAfterTasks
 * @returns {Promise<number>} how many ran, one after another (tasks they schedule run too)
 */
export const runAfterTasks = async (): Promise<number> => {
  let ran = 0;
  for (let task = tasks.shift(); task; task = tasks.shift()) {
    await task();
    ran += 1;
  }
  return ran;
};

/**
 * @function clearAfterTasks
 * @returns {void} every kept task dropped
 */
export const clearAfterTasks = (): void => {
  tasks.length = 0;
};

/**
 * @function afterTaskCount
 * @returns {number} tasks waiting
 */
export const afterTaskCount = (): number => tasks.length;
