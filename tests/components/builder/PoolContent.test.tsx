/**
 * @file tests/components/builder/PoolContent.test.tsx
 * @desc The editor's pool pane beyond moving: a paste's unreadable lines listed with nothing
 *       sent (and the server's own bad_paste lines, rolled back), a paste that applies and the
 *       new maps' details asked for, details saved in place and checked first, custom buckets
 *       added with forced mods and removed, and "Find maps" focusing the map browser pane.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtMap, clientPool } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => vi.clearAllMocks());

const pasteBox = () => screen.getByRole("textbox", { name: "Paste maps" });

describe("PoolEditor: pasting", () => {
  it("lists the lines it can't read and sends nothing", async () => {
    const { api, user, order } = renderEditor();
    await user.type(pasteBox(), "NM4 40{Enter}not a map");
    await user.click(screen.getByRole("button", { name: "Paste maps" }));
    expect(screen.getByText("These lines couldn't be read:")).toBeInTheDocument();
    expect(screen.getByText("Line 2")).toBeInTheDocument();
    expect(screen.getByText("not a map")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Some lines couldn't be read.");
    expect(pasteBox()).toHaveValue("NM4 40\nnot a map");
    expect(order()).toEqual([10, 20, 30]);
    expect(api.calls).toEqual([]);
  });

  it("shows the server's bad lines and rolls the paste back", async () => {
    const { api, user, order } = renderEditor();
    api.next(() =>
      Response.json(
        {
          error: {
            code: "bad_paste",
            message: "Some lines couldn't be read.",
            op: 0,
            lines: [{ line: 1, text: "NM4 40", code: "unrecognized", reason: "Not a map." }],
          },
        },
        { status: 400 },
      ),
    );
    await user.type(pasteBox(), "NM4 40");
    await user.click(screen.getByRole("button", { name: "Paste maps" }));
    expect(await screen.findByText("Line 1")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your last change wasn't saved.");
    expect(order()).toEqual([10, 20, 30]);
  });

  it("adds pasted maps, clears the box and asks for the new maps' details", async () => {
    const { api, user, order, saved } = renderEditor();
    api.details = [builtMap(40, { title: "Fresh Song", setHost: "Newcomer" })];
    await user.type(pasteBox(), "NM4 40");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "What the paste does" }),
      "merge",
    );
    await user.click(screen.getByRole("button", { name: "Paste maps" }));
    expect(order()).toEqual([10, 20, 30, 40]);
    expect(pasteBox()).toHaveValue("");
    expect(await screen.findByText("xi - Fresh Song")).toBeInTheDocument();
    expect(screen.getByText("[Hard] mapped by Newcomer")).toBeInTheDocument();
    await saved();
    const paths = api.calls.map((call) => `${call.method} ${call.path}`);
    expect(paths).toContain("GET /api/pools/b-a0000001/maps");
    expect(api.calls.find((call) => call.path.endsWith("/ops"))?.body).toEqual({
      baseVersion: 1,
      ops: [{ type: "replaceMaps", text: "NM4 40", mode: "merge" }],
    });
  });
});

describe("PoolEditor: details and slots", () => {
  it("saves a detail when it loses focus, and checks it first", async () => {
    const { api, user, saved } = renderEditor();
    const name = screen.getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.tab();
    expect(name).toHaveAccessibleDescription("Give the pool a name.");
    expect(name).toHaveAttribute("aria-invalid", "true");
    await user.type(name, "  Autumn Cup  ");
    await user.tab();
    await saved();
    const year = screen.getByRole("textbox", { name: "Year" });
    await user.clear(year);
    await user.type(year, "20x6{Enter}");
    expect(year).toHaveAccessibleDescription(/A year is a whole number\./);
    await user.clear(year);
    await user.type(year, "{Enter}");
    await saved();
    expect(api.calls.map((call) => call.body)).toEqual([
      { baseVersion: 1, ops: [{ type: "setDetails", name: "Autumn Cup" }] },
      { baseVersion: 2, ops: [{ type: "setDetails", year: null }] },
    ]);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Autumn Cup");
  });

  it("adds a custom bucket with forced mods, and removes it while empty", async () => {
    const { api, user, saved } = renderEditor();
    await user.type(screen.getByRole("textbox", { name: "Slot code" }), "HDHR");
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Pick at least one mod.");
    await user.click(screen.getByRole("button", { name: "HD" }));
    await user.click(screen.getByRole("button", { name: "HR" }));
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    expect(screen.getByRole("heading", { name: /^HDHR\s*Forced HD HR$/ })).toBeInTheDocument();
    await saved();
    await user.type(screen.getByRole("textbox", { name: "Slot code" }), "nm");
    await user.click(screen.getByRole("button", { name: "Add slot" }));
    expect(screen.getByRole("textbox", { name: "Slot code" })).toHaveAccessibleDescription(
      /That's a built-in slot\./,
    );
    await user.click(screen.getByRole("button", { name: "Remove slot HDHR" }));
    expect(screen.queryByRole("heading", { name: /^HDHR/ })).not.toBeInTheDocument();
    await saved();
    expect(api.calls.map((call) => (call.body as { ops: unknown[] }).ops)).toEqual([
      [{ type: "addBucket", code: "HDHR", mods: { kind: "forced", set: ["HD", "HR"] } }],
      [{ type: "removeBucket", code: "HDHR" }],
    ]);
  });

  it("brings focus to the map browser pane from a bucket's Find maps, under its lens", async () => {
    const { user } = renderEditor(clientPool());
    await user.click(screen.getByRole("button", { name: "Find maps for HD" }));
    expect(screen.getByRole("heading", { name: "Find maps" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Values under" })).toHaveValue("HD");
  });
});
