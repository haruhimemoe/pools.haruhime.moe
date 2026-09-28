/**
 * @file tests/components/builder/PoolEditor.test.tsx
 * @desc The pool editor's maps and saving: moving with the keyboard alone (focus stays on the
 *       moved map), move to another bucket and remove, each change sent at once with the last
 *       saved version, the optimistic copy rolled back on an error, the 409 notice with the
 *       reloaded pool, and "Find maps" bringing focus to the map browser pane. No network: a
 *       fake pool API applies the ops with the builder's own rules.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONFLICT } from "@/hooks/usePoolEditor";
import type { ClientPool } from "@/schemas/built-pool-view";
import { clientPool, nm } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => vi.clearAllMocks());

const setup = (pool?: ClientPool, pollMs?: number) => renderEditor(pool, pollMs ? { pollMs } : {});

const button = (name: string) => screen.getByRole("button", { name });

describe("PoolEditor: moving maps", () => {
  it("moves a map up and down with the keyboard alone, keeping focus on it", async () => {
    const { api, user, order, saved } = setup();
    button("Move NM2 up").focus();
    await user.keyboard("{Enter}");
    expect(order()).toEqual([20, 10, 30]);
    // At the top now, so its Up is off: focus goes to its Down.
    expect(button("Move NM1 down")).toHaveFocus();
    await saved();
    await user.keyboard(" ");
    expect(order()).toEqual([10, 20, 30]);
    expect(button("Move NM2 down")).toHaveFocus();
    await saved();
    expect(api.calls.map((call) => call.body)).toEqual([
      {
        baseVersion: 1,
        ops: [{ type: "moveMap", slot: { bucket: "NM", index: 2 }, bucket: "NM", index: 1 }],
      },
      {
        baseVersion: 2,
        ops: [{ type: "moveMap", slot: { bucket: "NM", index: 1 }, bucket: "NM", index: 2 }],
      },
    ]);
  });

  it("moves a map to another bucket and removes one, focus following", async () => {
    const { api, user, order, saved } = setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Move NM3 to" }), "HD");
    await user.tab();
    expect(button("Move NM3 to HD")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(order()).toEqual([10, 20]);
    expect(order("HD")).toEqual([30]);
    expect(screen.getByRole("combobox", { name: "Move HD1 to" })).toHaveFocus();
    await saved();
    button("Remove NM1").focus();
    await user.keyboard("{Enter}");
    expect(order()).toEqual([20]);
    expect(document.activeElement?.closest("li")?.getAttribute("data-map")).toBe("20");
    await saved();
    expect(api.pool.slots).toEqual([nm(1, 20), { mod: "HD", index: 1, beatmapId: 30 }]);
  });
});

describe("PoolEditor: saving", () => {
  it("shows a change at once and rolls it back when the save fails", async () => {
    const { api, user, order } = setup();
    let answer: (response: Response) => void = () => undefined;
    api.next(() => new Promise<Response>((resolve) => (answer = resolve)));
    await user.click(button("Remove NM2"));
    expect(order()).toEqual([10, 30]);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    answer(
      Response.json(
        { error: { code: "unknown_slot", message: "That map isn't in the pool any more." } },
        { status: 400 },
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That map isn't in the pool any more. Your last change wasn't saved.",
    );
    expect(order()).toEqual([10, 20, 30]);
    expect(screen.getByText("All changes saved.")).toBeInTheDocument();
  });

  it("says so when pools can't be reached, and puts the change back", async () => {
    const { api, user, order } = setup();
    api.next(() => Promise.reject(new TypeError("offline")));
    await user.click(button("Remove NM1"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach pools.");
    expect(order()).toEqual([10, 20, 30]);
  });

  it("reloads the pool on a 409 and says the last change wasn't saved", async () => {
    const { api, user, order, saved } = setup();
    const theirs = clientPool({ name: "Renamed elsewhere", version: 7, slots: [nm(1, 10)] });
    api.next(() =>
      Response.json({ error: { code: "conflict", message: "x" }, pool: theirs }, { status: 409 }),
    );
    api.pool = theirs;
    await user.click(button("Move NM2 up"));
    expect(await screen.findByText(CONFLICT)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Renamed elsewhere");
    expect(order()).toEqual([10]);
    await user.click(button("Remove NM1"));
    await saved();
    expect(api.calls.at(-1)?.body).toMatchObject({ baseVersion: 7 });
    expect(screen.queryByText(CONFLICT)).not.toBeInTheDocument();
  });

  it("checks the version on window focus and on a timer, taking a newer pool", async () => {
    const { api } = setup(clientPool(), 30);
    api.pool = { ...api.pool, name: "Changed by an editor", version: 2 };
    window.dispatchEvent(new Event("focus"));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Changed by an editor",
    );
    api.pool = { ...api.pool, name: "Changed again", version: 3 };
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Changed again"),
    );
    expect(api.calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("says when the pool has gone", async () => {
    const { api } = setup();
    api.next(() => Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 }));
    window.dispatchEvent(new Event("focus"));
    expect(await screen.findByRole("alert")).toHaveTextContent("This pool isn't here any more");
  });
});
