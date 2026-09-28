/**
 * @file tests/components/builder/Candidates.test.tsx
 * @desc Candidates in the editor: each slot's collapsible list (stars under the slot's mods, who
 *       added it, its note, "N of M editors"), Promote (carrying the old pick's set), the
 *       viewer's own vote as a toggle, Remove, "To candidates" on a pick (the slot stays, with
 *       no pick), and drag and drop between a pick and the candidates and between slots of a
 *       bucket. The pool's page never shows them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuiltSlotList } from "@/components/builder/BuiltSlotList";
import { candidate } from "../../helpers/candidates";
import { clientPool, mapsFor } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

const NM1 = { bucket: "NM", index: 1 };
const withCandidates = () =>
  clientPool({
    me: 10,
    candidates: {
      "NM:1": [
        candidate(11, { addedBy: 20, note: "safer pick", votes: [20] }),
        candidate(12, { addedBy: 10 }),
      ],
      "NM:5": [candidate(51)],
    },
  });
const opsOf = (calls: { path: string; body: unknown }[]) =>
  calls
    .filter((call) => call.path.endsWith("/ops"))
    .map((call) => (call.body as { ops: unknown[] }).ops);
const candidateRow = (id: number) =>
  document.querySelector(`li[data-candidate="${id}"]`) as HTMLElement;
const transfer = () => ({ setData: vi.fn(), effectAllowed: "", dropEffect: "" });
const drag = (from: HTMLElement, onto: HTMLElement) => {
  const dataTransfer = transfer();
  const handle = from.querySelector("[data-drag-handle]") as HTMLElement;
  fireEvent.dragStart(handle, { dataTransfer });
  fireEvent.dragOver(onto, { dataTransfer });
  fireEvent.drop(onto, { dataTransfer });
  fireEvent.dragEnd(handle, { dataTransfer });
};

describe("a slot's candidates", () => {
  it("opens the list with stars under the slot's mods, adder, note and votes", async () => {
    const { user } = renderEditor(withCandidates());
    const toggle = screen.getByRole("button", { name: /^2 candidates\s*for NM1$/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const row = within(candidateRow(11));
    expect(row.getByText(/5\.00★ no mod/)).toBeInTheDocument();
    expect(row.getByText("added by editor")).toBeInTheDocument();
    expect(row.getByText("safer pick")).toBeInTheDocument();
    expect(row.getByRole("button", { name: /^Vote for .*: 1 of 2 editors$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // A slot with candidates and no pick shows open, and says so.
    expect(screen.getByText(/No pick yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1 candidate\s*for NM5$/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("promotes, votes and removes, each a change of its own", async () => {
    const { api, user, order, saved } = renderEditor(withCandidates());
    await user.click(screen.getByRole("button", { name: /^2 candidates\s*for NM1$/ }));
    await user.click(within(candidateRow(12)).getByRole("button", { name: /^Vote for/ }));
    expect(within(candidateRow(12)).getByRole("button", { name: /Take back/ })).toHaveTextContent(
      "Voted · 1 of 2 editors",
    );
    await saved();
    await user.click(within(candidateRow(11)).getByRole("button", { name: /^Promote/ }));
    expect(order()).toEqual([11, 20, 30]);
    await saved();
    await user.click(within(candidateRow(12)).getByRole("button", { name: /^Remove/ }));
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [{ type: "voteCandidate", slot: NM1, beatmapId: 12, on: true }],
      [{ type: "promoteCandidate", slot: NM1, beatmapId: 11, pickSetId: 100 }],
      [{ type: "removeCandidate", slot: NM1, beatmapId: 12 }],
    ]);
  });

  it("makes a pick a candidate and keeps its slot", async () => {
    const { api, user, order, saved } = renderEditor(withCandidates());
    await user.click(screen.getByRole("button", { name: "Make NM2's pick a candidate" }));
    expect(order()).toEqual([10, 30]);
    expect(screen.getAllByText(/No pick yet/)).toHaveLength(2);
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [{ type: "demotePick", slot: { bucket: "NM", index: 2 }, beatmapsetId: 200 }],
    ]);
  });
});

describe("dragging candidates", () => {
  it("promotes a candidate dropped on a pick, and demotes a pick dropped on a list", async () => {
    const { api, user, order, saved } = renderEditor(withCandidates());
    await user.click(screen.getByRole("button", { name: /^2 candidates\s*for NM1$/ }));
    drag(candidateRow(12), document.querySelector('li[data-map="10"]') as HTMLElement);
    expect(order()).toEqual([12, 20, 30]);
    await saved();
    const list = document.querySelector('[data-drop-zone="candidates"][data-drop-index="5"]');
    drag(document.querySelector('li[data-map="30"]') as HTMLElement, list as HTMLElement);
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [{ type: "promoteCandidate", slot: NM1, beatmapId: 12, pickSetId: 100 }],
      [
        { type: "demotePick", slot: { bucket: "NM", index: 3 }, beatmapsetId: 300 },
        { type: "moveCandidate", slot: { bucket: "NM", index: 3 }, beatmapId: 30, to: 5 },
      ],
    ]);
  });

  it("moves a candidate to another slot of the bucket", async () => {
    const { api, user, saved } = renderEditor(withCandidates());
    await user.click(screen.getByRole("button", { name: /^2 candidates\s*for NM1$/ }));
    const list = document.querySelector('[data-drop-zone="candidates"][data-drop-index="5"]');
    drag(candidateRow(11), list as HTMLElement);
    await saved();
    expect(opsOf(api.calls)).toEqual([
      [{ type: "moveCandidate", slot: NM1, beatmapId: 11, to: 5 }],
    ]);
  });
});

describe("the pool's page", () => {
  it("never shows candidates, whatever the pool holds", () => {
    const pool = withCandidates();
    render(<BuiltSlotList pool={pool} maps={mapsFor([10, 11, 12, 20, 30, 51])} values={{}} />);
    expect(screen.queryByText(/candidate/i)).toBeNull();
    expect(screen.queryByText(/Song 11/)).toBeNull();
  });
});
