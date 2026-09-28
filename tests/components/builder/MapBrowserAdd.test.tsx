/**
 * @file tests/components/builder/MapBrowserAdd.test.tsx
 * @desc Adding from the map browser: Add goes to the lens's slot (NM, HD, HR, DT, or the custom
 *       slot forced to the lens's mods; the slot Find maps opened it for while the lens matches),
 *       and with no match it opens the slot picker instead; "Choose slot" opens it for any slot
 *       or none; Escape and Cancel close it and give focus back to Add; a map in the pool can't
 *       be added again; each button's name starts with the words on it; all of it works from
 *       the keyboard. Find maps keeps its slot even when its
 *       mods aren't a lens, and goes back to Ranked from Qualified. In the editor, Add sends
 *       addMap, and a 409 takes the server's pool with the notice.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFLICT } from "@/hooks/usePoolEditor";
import { diff, renderPane, set } from "../../helpers/browse-pane";
import { browsePage, clientPool, DEFAULT_BUCKETS, nm } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const home = () => window.history.replaceState(null, "", "/pools/b-a0000001/edit");
beforeEach(home);
afterEach(home);

const EZ = { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } } as BucketEntry;
const BUCKETS = [...DEFAULT_BUCKETS.slice(0, 5), EZ, DEFAULT_BUCKETS[5]] as BucketEntry[];

/**
 * Picks a lens once a page is on screen and waits for the answer under it: the ranges name the
 * lens of the page on screen, so they change only when that answer comes.
 */
const underLens = async (user: ReturnType<typeof renderPane>["user"], lens: string) => {
  await screen.findByText("xi - Song 1");
  await user.selectOptions(screen.getByRole("combobox", { name: /Values under/ }), lens);
  await screen.findByRole("group", { name: `Stars (${lens})` });
};

describe("Add", () => {
  it("adds to the slot the lens names", async () => {
    const { user, onAdd } = renderPane({ buckets: BUCKETS });
    await underLens(user, "HR");
    await user.click(screen.getByRole("button", { name: "Add to HR: Diff 11" }));
    await underLens(user, "EZ");
    await user.click(screen.getByRole("button", { name: "Add to EZ: Diff 12" }));
    expect(onAdd.mock.calls).toEqual([
      [11, "HR"],
      [12, "EZ"],
    ]);
  });

  it("adds to the slot Find maps opened it for while the lens still matches", async () => {
    const { user, onAdd, rerender } = renderPane();
    rerender({ openedFor: "FM", openCount: 1 });
    await user.click(await screen.findByRole("button", { name: "Add to FM: Diff 11" }));
    expect(onAdd).toHaveBeenCalledWith(11, "FM");
    await underLens(user, "HD");
    expect(screen.getByRole("button", { name: "Add to HD: Diff 11" })).toBeInTheDocument();
  });

  it("keeps the slot Find maps opened it for when its mods aren't a lens", async () => {
    const HDFL = { code: "HDFL", color: 1, mods: { kind: "forced", set: ["HD", "FL"] } };
    const { user, onAdd, rerender } = renderPane({ buckets: [...BUCKETS, HDFL] as BucketEntry[] });
    rerender({ openedFor: "HDFL", openCount: 1 });
    await user.click(await screen.findByRole("button", { name: "Add to HDFL: Diff 11" }));
    expect(onAdd).toHaveBeenCalledWith(11, "HDFL");
  });

  it("goes back to Ranked when Find maps is pressed on Qualified", async () => {
    const { user, onAdd, rerender } = renderPane();
    await user.click(await screen.findByRole("radio", { name: "Qualified" }));
    rerender({ openedFor: "DT", openCount: 1 });
    expect(screen.getByRole("radio", { name: "Ranked" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /Values under/ })).toHaveValue("DT");
    await user.click(await screen.findByRole("button", { name: "Add to DT: Diff 11" }));
    expect(onAdd).toHaveBeenCalledWith(11, "DT");
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
    const choose = screen.getByRole("button", { name: "Choose slot for Diff 12" });
    await user.click(choose);
    expect(choose).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox", { name: "Slot" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to NM: Diff 12" })).toHaveFocus();
    await user.click(choose);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(choose);
    await user.selectOptions(screen.getByRole("combobox", { name: "Slot" }), "EZ");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd.mock.calls).toEqual([[12, "EZ"]]);
  });

  it("can't add a map the pool has", async () => {
    const { user, onAdd } = renderPane({ poolIds: [11] });
    const inPool = await screen.findByRole("button", { name: "In this pool: Diff 11" });
    expect(inPool).toHaveTextContent("In this pool");
    expect(inPool).toHaveAttribute("aria-disabled", "true");
    await user.click(inPool);
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Choose slot for Diff 11" })).toBeNull();
  });

  it("names each button starting with the words on it, for voice control", async () => {
    renderPane({ poolIds: [12] });
    await screen.findByRole("button", { name: "Add to NM: Diff 11" });
    const buttons = screen
      .getAllByRole("button")
      .filter((button) => button.closest("[data-diff]") !== null);
    expect(buttons.length).toBeGreaterThan(2);
    for (const button of buttons) {
      const name = button.getAttribute("aria-label") ?? button.textContent ?? "";
      expect(name.startsWith(button.textContent ?? "")).toBe(true);
    }
  });
});

describe("Add from the keyboard", () => {
  it("adds, opens the picker, picks a slot and adds with keys alone", async () => {
    const { user, onAdd } = renderPane({ buckets: BUCKETS });
    const add = await screen.findByRole("button", { name: "Add to NM: Diff 11" });
    add.focus();
    await user.keyboard("{Enter}");
    expect(onAdd).toHaveBeenLastCalledWith(11, "NM");
    await user.tab();
    expect(screen.getByRole("button", { name: "Choose slot for Diff 11" })).toHaveFocus();
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
    await user.click(await screen.findByRole("button", { name: "Add to NM: Diff 77" }));
    await saved();
    expect(api.calls.at(-1)?.body).toMatchObject({
      ops: [{ type: "addMap", beatmapId: 77, bucket: "NM" }],
    });
    expect(order()).toEqual([10, 20, 30, 77]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "In this pool: Diff 77" })).toBeInTheDocument(),
    );
  });

  it("takes the pool the server sent on a 409, and says the add wasn't saved", async () => {
    const { api, user, order } = renderEditor(clientPool());
    api.browse = browsePage({ sets: [set(1, [diff(77)])] });
    const theirs = clientPool({ version: 9, slots: [nm(1, 10)] });
    api.next(() =>
      Response.json({ error: { code: "conflict", message: "x" }, pool: theirs }, { status: 409 }),
    );
    api.pool = theirs;
    await user.click(await screen.findByRole("button", { name: "Add to NM: Diff 77" }));
    expect(await screen.findByText(CONFLICT)).toBeInTheDocument();
    expect(order()).toEqual([10]);
    expect(screen.getByRole("button", { name: "Add to NM: Diff 77" })).toBeInTheDocument();
  });
});
