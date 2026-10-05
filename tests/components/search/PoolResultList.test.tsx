/**
 * @file tests/components/search/PoolResultList.test.tsx
 * @desc PoolResultList renders each result as a rounded Surface row, not the old rounded-lg box.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PoolResultList } from "@/components/search/PoolResultList";
import type { PoolResult } from "@/schemas/search-response";

const result = (overrides: Partial<PoolResult>): PoolResult => ({
  kind: "past",
  builtBy: null,
  id: "o-1",
  name: "Freedom Dive Invitational",
  tournament: "Freedom Dive Invitational",
  round: "Finals",
  year: 2026,
  badged: null,
  stats: { srMin: 5, srMax: 7, count: 8, complete: true },
  ...overrides,
});

describe("PoolResultList", () => {
  it("renders each result on a rounded Surface, not the old box", () => {
    render(
      <PoolResultList
        results={[result({ id: "o-1" }), result({ id: "o-2", name: "Another Pool" })]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.className).toContain("rounded-[10px]");
      expect(item.className).toContain("bg-b4");
      expect(item.className).toContain("p-4");
      expect(item.className).not.toContain("rounded-lg");
    }
  });
});
