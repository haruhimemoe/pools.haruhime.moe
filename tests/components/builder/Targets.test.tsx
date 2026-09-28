/**
 * @file tests/components/builder/Targets.test.tsx
 * @desc Bucket targets in the editor: placeholder rows up to each bucket's count, a badge on a
 *       map whose stars under its slot's mods sit outside the bucket's range, the summary's
 *       lists of both, the Targets form (a target saved as setTarget, a bad count or range said
 *       under its field with nothing sent, a bucket's own target filled in when picked), and
 *       "Find maps" on a bucket with a range putting it in the star filter.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientPool } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const home = () => window.history.replaceState(null, "", "/pools/b-a0000001/edit");
beforeEach(home);
afterEach(() => {
  home();
  vi.clearAllMocks();
});

const RANGE = { min: 5.8, max: 6.3 };
const bucket = (code: string) => document.querySelector(`[data-bucket="${code}"]`) as HTMLElement;
const targetsCard = () =>
  screen.getByRole("heading", { name: "Targets" }).closest("section") as HTMLElement;

describe("targets in the pool pane and summary", () => {
  it("shows placeholders up to each target and the summary's shortfall", () => {
    renderEditor(clientPool({ targets: { NM: { count: 5 }, HD: { count: 1 } } }));
    expect(within(bucket("NM")).getByText("2 more NM maps")).toBeInTheDocument();
    expect(within(bucket("HD")).getByText("1 more HD map")).toBeInTheDocument();
    expect(within(bucket("HR")).queryByText(/more HR/)).toBeNull();
    const summary = screen.getByRole("region", { name: "Targets short of maps" });
    expect(summary).toHaveTextContent("NM3 of 5 maps (2 more)");
    expect(summary).toHaveTextContent("HD0 of 1 map (1 more)");
  });

  it("badges a map outside its bucket's star range and lists it in the summary", () => {
    renderEditor(clientPool({ targets: { NM: { count: 3, sr: RANGE } } }));
    const row = bucket("NM").querySelector('[data-map="10"]') as HTMLElement;
    expect(within(row).getByText("Below 5.80–6.30★")).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Maps outside their star range" });
    expect(summary).toHaveTextContent("NM1 5.00★, below 5.80–6.30★");
  });
});

describe("the Targets form", () => {
  it("saves a target as setTarget and shows its placeholder", async () => {
    const { api, user, saved } = renderEditor();
    const card = targetsCard();
    await user.selectOptions(within(card).getByRole("combobox", { name: "Slot" }), "HD");
    await user.type(within(card).getByRole("textbox", { name: "Maps" }), "3");
    await user.type(within(card).getByRole("textbox", { name: "Lowest stars" }), "5.5");
    await user.type(within(card).getByRole("textbox", { name: "Highest stars" }), "6");
    await user.click(within(card).getByRole("button", { name: "Save target" }));
    expect(within(bucket("HD")).getByText("3 more HD maps")).toBeInTheDocument();
    await saved();
    expect(api.calls.find((call) => call.path.endsWith("/ops"))?.body).toEqual({
      baseVersion: 1,
      ops: [{ type: "setTarget", bucket: "HD", count: 3, sr: { min: 5.5, max: 6 } }],
    });
    expect(within(card).getByText("HD: 3 maps, 5.50–6.00★")).toBeInTheDocument();
  });

  it("says what's wrong under the field and sends nothing", async () => {
    const { api, user } = renderEditor();
    const card = targetsCard();
    await user.type(within(card).getByRole("textbox", { name: "Maps" }), "20");
    await user.click(within(card).getByRole("button", { name: "Save target" }));
    expect(within(card).getByText("A slot's target is 0 to 16 maps.")).toBeInTheDocument();
    await user.clear(within(card).getByRole("textbox", { name: "Maps" }));
    await user.type(within(card).getByRole("textbox", { name: "Lowest stars" }), "6");
    await user.click(within(card).getByRole("button", { name: "Save target" }));
    expect(
      within(card).getByText("Give both ends of the star range, or neither."),
    ).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it("fills in the picked bucket's target", async () => {
    const { user } = renderEditor(clientPool({ targets: { DT: { count: 4, sr: RANGE } } }));
    const card = targetsCard();
    await user.selectOptions(within(card).getByRole("combobox", { name: "Slot" }), "DT");
    expect(within(card).getByRole("textbox", { name: "Maps" })).toHaveValue("4");
    expect(within(card).getByRole("textbox", { name: "Lowest stars" })).toHaveValue("5.8");
    expect(within(card).getByRole("textbox", { name: "Highest stars" })).toHaveValue("6.3");
  });
});

describe("Find maps with a star range", () => {
  it("puts the bucket's range in the star filter", async () => {
    const { api, user } = renderEditor(clientPool({ targets: { NM: { count: 5, sr: RANGE } } }));
    await user.click(screen.getByRole("button", { name: "Find maps for NM" }));
    await waitFor(() => expect(api.browseCalls.at(-1)?.searchParams.get("sr")).toBe("5.8-6.3"));
  });
});
