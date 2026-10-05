/**
 * @file tests/helpers/keyboard-drag.ts
 * @desc A keyboard drag through ui's sortable lists: focus a handle, pick it up with Space, go
 *       to the first list (PageUp) and its first target (Home), step with ArrowDown until the
 *       live region names the wanted target, then drop with Enter. Fails when the target never
 *       comes up.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Mon Oct 5, 2026
 */

import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { expect } from "vitest";

/** The editor's sortable live region (SortableLayer's sr-only assertive div). */
export const live = (): HTMLElement =>
  document.querySelector<HTMLElement>('div.sr-only[aria-live="assertive"]') as HTMLElement;

/**
 * @function keyboardDrag
 * @param user {UserEvent} the test's session
 * @param handle {string | HTMLElement} the handle's name ("Reorder NM3") or the element
 * @param over {string} text the live region says over the wanted target (": onto NM1.")
 * @returns {Promise<void>} once dropped
 */
export const keyboardDrag = async (
  user: UserEvent,
  handle: string | HTMLElement,
  over: string,
): Promise<void> => {
  const grip = typeof handle === "string" ? screen.getByRole("button", { name: handle }) : handle;
  grip.focus();
  await user.keyboard(" ");
  for (let i = 0; i < 12; i++) await user.keyboard("{PageUp}");
  await user.keyboard("{Home}");
  for (let i = 0; i < 80 && !live().textContent?.includes(over); i++) {
    await user.keyboard("{ArrowDown}");
  }
  expect(live()).toHaveTextContent(over);
  await user.keyboard("{Enter}");
};
