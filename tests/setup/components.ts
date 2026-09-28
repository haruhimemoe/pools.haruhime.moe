/**
 * @file tests/setup/components.ts
 * @desc Setup for the jsdom "components" project: jest-dom matchers + DOM cleanup between tests,
 *       and a 5 s wait for findBy queries (the editor's first render is heavy; a full run on a
 *       busy machine took longer than the 1 s default).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});
