/**
 * @file tests/components/home/MapSearchForm.test.tsx
 * @desc The home page's map box: a beatmap ID or link opens the map, words search maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapSearchForm } from "@/components/home/MapSearchForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockClear());

describe("MapSearchForm", () => {
  it.each([
    ["129891", "/maps/129891"],
    ["freedom dive", "/search?tab=maps&q=freedom%20dive"],
  ])("sends %j to %s", async (typed, target) => {
    const user = userEvent.setup();
    render(<MapSearchForm />);
    await user.type(
      screen.getByLabelText("Any osu! map: title, artist, mapper, or a beatmap ID or link"),
      typed,
    );
    await user.click(screen.getByRole("button", { name: "Search maps" }));
    expect(push).toHaveBeenCalledWith(target);
  });
});
