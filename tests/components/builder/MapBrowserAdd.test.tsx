/**
 * @file tests/components/builder/MapBrowserAdd.test.tsx
 * @desc Adding from the map browser: Add goes to the lens's slot (NM, HD, HR, DT, or the custom
 *       slot forced to the lens's mods; the slot Find maps opened it for while the lens matches),
 *       and with no match it opens the slot picker instead; "Choose slot" opens it for any slot
 *       or none; Escape and Cancel close it and give focus back to Add; a map in the pool can't
 *       be added again; all of it works from the keyboard. In the editor, Add sends addMap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diff, renderPane, set } from "../../helpers/browse-pane";
import { browsePage, clientPool, DEFAULT_BUCKETS } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const home = () => window.history.replaceState(null, "", "/pools/b-a0000001/edit");
beforeEach(home);
afterEach(home);

const EZ = { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } } as BucketEntry;
const BUCKETS = [...DEFAULT_BUCKETS.slice(0, 5), EZ, DEFAULT_BUCKETS[5]] as BucketEntry[];

const underLens = async (user: ReturnType<typeof renderPane>["user"], lens: string) => {
  await user.selectOptions(await screen.findByRole("combobox", { name: /Values under/ }), lens);
  await screen.findByText("xi - Song 1");
};

describe("Add", () => {
  it("adds to the slot the lens names", async () => {
    const { user, onAdd } = renderPane({ buckets: BUCKETS });
    await underLens(user, "HR");
    await user.click(screen.getByRole("button", { name: "Add Diff 11 to HR" }));
    await underLens(user, "EZ");
    await user.click(screen.getByRole("button", { name: "Add Diff 12 to EZ" }));
    expect(onAdd.mock.calls).toEqual([
      [11, "HR"],
      [12, "EZ"],
    ]);
  });

  it("adds to the slot Find maps opened it for while the lens still matches", async () => {
    const { user, onAdd, rerender } = renderPane();
    rerender({ openedFor: "FM", openCount: 1 });
    await user.click(await screen.findByRole("button", { name: "Add Diff 11 to FM" }));
    expect(onAdd).toHaveBeenCalledWith(11, "FM");
    await underLens(user, "HD");
    expect(screen.getByRole("button", { name: "Add Diff 11 to HD" })).toBeInTheDocument();
  });

  it("opens the slot picker when no slot matches the lens", async () => {
    const { user, onAdd } = renderPane({ buckets: BUCKETS });
    await underLens(user, "HT");
    await user.click(screen.getByRole("button", { name: "Add Diff 11: choose a slot" }));
    const slot = screen.getByRole("combobox", { name: "Slot" });
    expect(slot).toHaveFocus();
    await user.selectOptions(slot, "No slot");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith(11, null);
    expect(screen.queryByRole("combobox", { name: "Slot" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Diff 11: choose a slot" })).toHaveFocus();
  });

  it("lets any slot be chosen, and closes the picker on Escape or Cancel", async () => {
    const { user, onAdd } = renderPane({ buckets: BUCKETS });
    await screen.findByText("xi - Song 1");
    const choose = screen.getByRole("button", { name: "Choose a slot for Diff 12" });
    await user.click(choose);
    expect(choose).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox", { name: "Slot" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Diff 12 to NM" })).toHaveFocus();
    await user.click(choose);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(choose);
    await user.selectOptions(screen.getByRole("combobox", { name: "Slot" }), "EZ");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd.mock.calls).toEqual([[12, "EZ"]]);
  });

  it("can't add a map the pool has", async () => {
    const { user, onAdd } = renderPane({ poolIds: [11] });
    const inPool = await screen.findByRole("button", { name: "Diff 11 is in this pool" });
    expect(inPool).toHaveTextContent("In this pool");
    expect(inPool).toHaveAttribute("aria-disabled", "true");
    await user.click(inPool);
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Choose a slot for Diff 11" })).toBeNull();
  });
});

describe("Add from the keyboard", () => {
  it("adds, opens the picker, picks a slot and adds with keys alone", async () => {
    const { user, onAdd } = renderPane({ buckets: BUCKETS });
    const add = await screen.findByRole("button", { name: "Add Diff 11 to NM" });
    add.focus();
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenLastCalledWith(11, "NM");
    await user.tab();
    expect(screen.getByRole("button", { name: "Choose a slot for Diff 11" })).toHaveFocus();
    await user.keyboard("{Enter}");
    const slot = screen.getByRole("combobox", { name: "Slot" });
    expect(slot).toHaveFocus();
    await user.selectOptions(slot, "HR");
    await user.tab();
    expect(screen.getByRole("button", { name: "Add" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenLastCalledWith(11, "HR");
    expect(add).toHaveFocus();
  });
});

describe("Add in the editor", () => {
  it("sends addMap for the lens's slot, and the map shows in the pool", async () => {
    const { api, user, order, saved } = renderEditor(clientPool());
    api.browse = browsePage({ sets: [set(1, [diff(77)])] });
    await user.click(await screen.findByRole("button", { name: "Add Diff 77 to NM" }));
    await saved();
    expect(api.calls.at(-1)?.body).toMatchObject({
      ops: [{ type: "addMap", beatmapId: 77, bucket: "NM" }],
    });
    expect(order()).toEqual([10, 20, 30, 77]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Diff 77 is in this pool" })).toBeInTheDocument(),
    );
  });
});
