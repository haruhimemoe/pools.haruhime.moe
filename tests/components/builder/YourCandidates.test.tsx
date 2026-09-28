/**
 * @file tests/components/builder/YourCandidates.test.tsx
 * @desc Adding candidates from the map browser: "Add as candidate" on a search result picks a
 *       slot (an existing one or a new one) and sends addCandidate with the set; the "Your
 *       candidates" source asks for the pool being edited under the current bucket, shows where
 *       each map is from and its note, filters by text and picks, and copies a map with its note
 *       (never its votes).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YourCandidateRow } from "@/schemas/your-candidates";
import { diff, set } from "../../helpers/browse-pane";
import { browsePage, builtMap, clientPool } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const home = () => window.history.replaceState(null, "", "/pools/b-a0000001/edit");
beforeEach(home);
afterEach(home);

const opsOf = (calls: { path: string; body: unknown }[]) =>
  calls
    .filter((call) => call.path.endsWith("/ops"))
    .map((call) => (call.body as { ops: unknown[] }).ops);

const OWN: YourCandidateRow = {
  poolId: "b-a0000002",
  poolName: "Autumn Cup",
  bucket: "HR",
  index: 2,
  kind: "candidate",
  beatmapId: 90,
  beatmapsetId: 900,
  note: "aim check",
  at: "2026-09-28T09:00:00.000Z",
  map: builtMap(90),
  values: null,
};

describe("Add as candidate", () => {
  it("adds a search result to the slot chosen, with its set", async () => {
    const { api, user, saved } = renderEditor(clientPool());
    api.browse = browsePage({ sets: [set(7, [diff(77)])] });
    await user.click(await screen.findByRole("button", { name: "Add as candidate: Diff 77" }));
    const slot = screen.getByRole("combobox", { name: "Candidate for" });
    expect(slot).toHaveFocus();
    expect(within(slot).getByRole("option", { name: "New NM4" })).toBeInTheDocument();
    await user.selectOptions(slot, "NM:2");
    await user.click(screen.getByRole("button", { name: "Add Diff 77 as a candidate" }));
    expect(screen.getByRole("button", { name: /^1 candidate\s*for NM2$/ })).toBeInTheDocument();
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [
        {
          type: "addCandidate",
          slot: { bucket: "NM", index: 2 },
          beatmapId: 77,
          beatmapsetId: 7,
        },
      ],
    ]);
  });
});

describe("Your candidates", () => {
  it("lists your candidates and copies one with its note", async () => {
    const { api, user, saved } = renderEditor(clientPool());
    api.own = () => ({ rows: [OWN], total: 1, page: 1, pages: 1, under: "NM", complete: true });
    await user.click(await screen.findByRole("radio", { name: "Your candidates" }));
    const row = await screen.findByText("Autumn Cup · HR2 candidate");
    expect(screen.getByText("aim check")).toBeInTheDocument();
    const url = api.ownCalls.at(-1);
    expect(url?.searchParams.get("pool")).toBe("b-a0000001");
    expect(url?.searchParams.get("under")).toBe("NM");
    const item = row.closest("li") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: /^Add as candidate/ }));
    await user.click(within(item).getByRole("button", { name: /as a candidate$/ }));
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [
        {
          type: "addCandidate",
          slot: { bucket: "NM", index: 1 },
          beatmapId: 90,
          beatmapsetId: 900,
          note: "aim check",
        },
      ],
    ]);
  });

  it("asks again with text and with picks", async () => {
    const { api, user } = renderEditor(clientPool());
    await user.click(await screen.findByRole("radio", { name: "Your candidates" }));
    await user.type(screen.getByRole("textbox", { name: /Search your candidates/ }), "dive");
    await waitFor(() => expect(api.ownCalls.at(-1)?.searchParams.get("q")).toBe("dive"));
    await user.click(screen.getByRole("checkbox", { name: "Include picks" }));
    await waitFor(() => expect(api.ownCalls.at(-1)?.searchParams.get("picks")).toBe("1"));
    expect(await screen.findByText(/No candidates yet/)).toBeInTheDocument();
  });
});
