/**
 * @file tests/components/builder/PoolEditor.test.tsx
 * @desc The pool editor's maps and saving: moving with the keyboard alone (focus stays on the
 *       moved map), move to another bucket and remove, each change sent at once with the last
 *       saved version, the optimistic copy rolled back on an error, the 409 notice with the
 *       reloaded pool, a pool that's gone (said once, and no more polling), the notice when
 *       moderators hid it (no search or pack for a private one), values under each slot's mods (and the summary's star range from
 *       them), and "Find maps" bringing focus to the map browser pane. No network: a
 *       fake pool API applies the ops with the builder's own rules.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HIDDEN_BY_MODERATION } from "@/constants/built-pools";
import { CONFLICT, GONE } from "@/hooks/usePoolEditor";
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

  it("says when the pool has gone, and stops asking for it", async () => {
    const { api } = setup(clientPool(), 20);
    api.next(() => Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 }));
    window.dispatchEvent(new Event("focus"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This pool was deleted or you no longer have access.",
    );
    const asked = api.calls.length;
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(api.calls).toHaveLength(asked);
  });

  it("stops asking once a save finds the pool gone", async () => {
    const { api, user } = setup(clientPool(), 20);
    api.next(() => Response.json({ error: { code: "not_found", message: "x" } }, { status: 404 }));
    await user.click(button("Remove NM3"));
    expect(await screen.findByText(GONE)).toBeInTheDocument();
    const asked = api.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(api.calls).toHaveLength(asked);
  });
});

describe("PoolEditor: moderation", () => {
  it("says when moderators hid the pool, and nothing when they didn't", () => {
    setup(clientPool({ hidden: true, visibility: "public" }));
    expect(screen.getByText(HIDDEN_BY_MODERATION.public)).toBeInTheDocument();
    cleanup();
    setup();
    expect(screen.queryByText(/Hidden by moderation/)).not.toBeInTheDocument();
  });

  it("says nothing of search or a pack for a private pool moderators hid", () => {
    setup(clientPool({ hidden: true }));
    expect(screen.getByText(HIDDEN_BY_MODERATION.private)).toBeInTheDocument();
    expect(HIDDEN_BY_MODERATION.private).not.toMatch(/search|pack/);
  });
});

describe("PoolEditor: values under each slot's mods", () => {
  const value = (stars: number, mods: string, source: "none" | "mirror" | "math") => ({
    stars,
    ar: 9,
    od: 8,
    cs: 4,
    bpm: mods === "DT" ? 270 : 180,
    length: mods === "DT" ? 80 : 120,
    mods,
    source,
  });

  it("shows what the page read, and asks for a slot's new mods once it's saved", async () => {
    const values = { "10:NM": value(5, "NM", "none"), "20:NM": value(5.1, "NM", "none") };
    const { api, user, saved } = renderEditor(clientPool({ slots: [nm(1, 10), nm(2, 20)] }), {
      values,
    });
    api.values = () => ({ ...values, "20:DT": value(7.2, "DT", "mirror") });
    const row = (id: number) => document.querySelector(`li[data-map="${id}"]`);
    expect(row(10)).toHaveTextContent("5.00★ no mod · AR 9 · OD 8 · 2:00 · 180 BPM");
    expect(api.valueCalls).toEqual([]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Move NM2 to" }), "DT");
    await user.click(button("Move NM2 to DT"));
    await saved();
    await waitFor(() =>
      expect(row(20)).toHaveTextContent("7.20★ DT · AR 9 · OD 8 · 1:20 · 270 BPM"),
    );
    expect(api.valueCalls).toEqual(["/api/pools/b-a0000001/values"]);
    const summary = screen.getByText("Star range per slot (with its mods)").closest("section");
    const range = (title: string) => within(summary as HTMLElement).getByText(title).nextSibling;
    expect(range("DT")).toHaveTextContent(/^7\.20★$/);
    expect(range("NM")).toHaveTextContent(/^5\.00★$/);
  });

  it("says no mod data when the mirror had none", async () => {
    const pool = clientPool({ slots: [{ mod: "HR", index: 1, beatmapId: 10 }] });
    const { api } = renderEditor(pool, { values: { "10:HR": value(5, "HR", "math") } });
    expect(document.querySelector('li[data-map="10"]')).toHaveTextContent(
      "5.00★ no mod · AR 9 · OD 8 · 2:00 · 180 BPM · no mod data",
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.valueCalls).toEqual([]);
  });

  it("asks again for the math of a page read the mirror didn't finish", async () => {
    const pool = clientPool({ slots: [{ mod: "HR", index: 1, beatmapId: 10 }] });
    const { api } = renderEditor(pool, {
      values: { "10:HR": value(5, "HR", "math") },
      valuesComplete: false,
    });
    await waitFor(() => expect(api.valueCalls).toEqual(["/api/pools/b-a0000001/values"]));
  });
});
