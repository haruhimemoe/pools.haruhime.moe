/**
 * @file tests/components/builder/OwnerPanel.test.tsx
 * @desc Who manages the pool: the owner's settings (visibility with the pack note only when it
 *       matters, adding and removing editors, handing the pool to an editor who has signed in and
 *       delete and handover each in a dialog behind the typed name, removing an editor after
 *       asking) and none of them for an editor, who can leave instead; once the pool is handed
 *       over, the old owner's settings go, and the always-there notice says so and takes focus.
 *       When packs didn't answer, deleting or going private still works and says the pack's
 *       removal waits. Requests take turns with the ops, so the next change carries the version
 *       they moved to. Also the editor's layout, by class: the panes and slot rows stack on
 *       phones, and the map browser sits under the maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_HANDOVER, PACK_NOTE, PACK_REMOVAL_QUEUED } from "@/constants/built-pools";
import { clientPool, EDITOR_ACCESS } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => vi.clearAllMocks());

describe("owner settings", () => {
  it("are hidden from an editor, who can leave the pool", async () => {
    const { api, user } = renderEditor(clientPool({ access: EDITOR_ACCESS }), { me: 20 });
    expect(screen.queryByRole("heading", { name: "Owner settings" })).not.toBeInTheDocument();
    expect(screen.queryByText("Who can see this pool")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete this pool" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Add an editor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /as an editor$/ })).not.toBeInTheDocument();
    expect(screen.getByText("You edit this pool.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Leave this pool" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/account#pools"));
    expect(api.calls).toEqual([
      { method: "DELETE", path: "/api/pools/b-a0000001/editors/20", body: undefined },
    ]);
  });

  it("deletes only once the pool's name is typed in the dialog, then goes to Your pools", async () => {
    const { api, user } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Delete this pool" }));
    const box = screen.getByRole("alertdialog", { name: "Delete Spring Cup Finals?" });
    const field = within(box).getByRole("textbox", { name: "Type Spring Cup Finals to confirm" });
    const remove = within(box).getByRole("button", { name: "Delete for good" });
    expect(field).toHaveFocus();
    expect(remove).toHaveAttribute("aria-disabled", "true");
    await user.type(field, "spring cup finals");
    expect(remove).toHaveAttribute("aria-disabled", "true");
    api.next(() => Response.json({ error: { message: "packs didn't answer." } }, { status: 502 }));
    await user.clear(field);
    await user.type(field, "Spring Cup Finals");
    await user.click(remove);
    expect(await within(box).findByRole("alert")).toHaveTextContent(
      "packs didn't answer. The pool is still there.",
    );
    expect(push).not.toHaveBeenCalled();
    await user.click(remove);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/account#pools"));
    // Until the page goes, the button doesn't come back: another press would only meet a 404.
    const said = screen.getByText("The pool is deleted.");
    expect(said).toHaveAttribute("role", "status");
    expect(said).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Delete this pool" })).not.toBeInTheDocument();
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "DELETE /api/pools/b-a0000001",
      "DELETE /api/pools/b-a0000001",
    ]);
  });

  it("says the pack's removal waits when a delete went through without packs", async () => {
    const { api, user } = renderEditor();
    api.next(() => Response.json({ packRemoval: "queued", notice: PACK_REMOVAL_QUEUED }));
    await user.click(screen.getByRole("button", { name: "Delete this pool" }));
    await user.type(
      screen.getByRole("textbox", { name: "Type Spring Cup Finals to confirm" }),
      "Spring Cup Finals",
    );
    await user.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(
      await screen.findByText(`The pool is deleted. ${PACK_REMOVAL_QUEUED}`),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to your pools" })).toHaveAttribute(
      "href",
      "/account#pools",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("says the pack's removal waits when going private went through without packs", async () => {
    const { api, user } = renderEditor(clientPool({ visibility: "public" }));
    api.next(() =>
      Response.json({
        pool: { ...api.pool, visibility: "private", version: 2 },
        packRemoval: "queued",
        notice: PACK_REMOVAL_QUEUED,
      }),
    );
    await user.click(screen.getByRole("radio", { name: /Private/ }));
    await user.click(screen.getByRole("button", { name: "Save who can see it" }));
    expect(await screen.findByText(`Saved: private. ${PACK_REMOVAL_QUEUED}`)).toBeInTheDocument();
  });

  it("change who can see it, noting the pack on packs only when it matters", async () => {
    const { api, user, saved } = renderEditor();
    expect(screen.queryByText(PACK_NOTE)).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Unlisted/ }));
    expect(screen.getByText(PACK_NOTE)).toBeInTheDocument();
    api.next(() => Response.json({ pool: { ...api.pool, visibility: "unlisted", version: 2 } }));
    await user.click(screen.getByRole("button", { name: "Save who can see it" }));
    expect(await screen.findByText("Saved: unlisted.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove NM3" }));
    await saved();
    expect(api.calls[0]).toMatchObject({ method: "PUT", body: { visibility: "unlisted" } });
    expect(api.calls[1]?.body).toMatchObject({ baseVersion: 2 });
  });
});

describe("handing the pool to an editor", () => {
  const editors = [
    { osuId: 20, username: "editor", signedIn: true },
    { osuId: 50, username: "newbie", signedIn: false },
  ];
  const typeName = async (user: ReturnType<typeof renderEditor>["user"], text: string) => {
    const field = screen.getByRole("textbox", { name: "Type Spring Cup Finals to hand it over" });
    await user.clear(field);
    await user.type(field, text);
  };

  it("offers editors who have signed in, and hands it over once the name is typed", async () => {
    const { api, user, container } = renderEditor(clientPool({ editors }));
    // The live region is there, empty, before anything is said in it.
    const region = container.querySelector("[data-handover]");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toBeEmptyDOMElement();
    expect(screen.getByRole("radio", { name: /newbie/ })).toBeDisabled();
    expect(screen.getByText("hasn't signed in yet")).toBeInTheDocument();
    const go = screen.getByRole("button", { name: "Hand the pool over" });
    expect(go).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "editor" }));
    expect(go).toBeEnabled();
    await user.click(go);
    const box = screen.getByRole("alertdialog", { name: "Hand this pool to editor?" });
    const confirm = within(box).getByRole("button", { name: "Hand it over" });
    await typeName(user, "spring cup finals");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await typeName(user, "Spring Cup Finals");
    const owner = { osuId: 20, username: "editor" };
    const after = { ...api.pool, owner, editors: [{ osuId: 10, username: "owner" }] };
    api.next(() => Response.json({ pool: { ...after, access: EDITOR_ACCESS, version: 2 } }));
    await user.click(confirm);
    const said = await screen.findByText("editor owns this pool now. You still edit it.");
    expect(said).toBeVisible();
    expect(said).toBe(region);
    // The owner's settings, with the dialog, are gone: focus goes to what was said.
    expect(said).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Owner settings" })).not.toBeInTheDocument();
    expect(screen.getByText("You edit this pool.")).toBeInTheDocument();
    expect(api.calls.at(-1)).toMatchObject({
      method: "POST",
      path: "/api/pools/b-a0000001/owner",
      body: { osuId: 20, confirmName: "Spring Cup Finals" },
    });
  });

  it("says why when it's refused, in the dialog, keeping the owner's settings", async () => {
    const { api, user } = renderEditor(clientPool({ editors }));
    await user.click(screen.getByRole("radio", { name: "editor" }));
    await user.click(screen.getByRole("button", { name: "Hand the pool over" }));
    await typeName(user, "Spring Cup Finals");
    const message = "editor already owns 50 pools.";
    api.next(() => Response.json({ error: { code: "too_many_pools", message } }, { status: 400 }));
    await user.click(screen.getByRole("button", { name: "Hand it over" }));
    // Name it: the closed delete dialog is an alertdialog too.
    const box = screen.getByRole("alertdialog", { name: "Hand this pool to editor?" });
    expect(await within(box).findByRole("alert")).toHaveTextContent(
      `${message} You still own the pool.`,
    );
    expect(screen.getByRole("heading", { name: "Owner settings" })).toBeInTheDocument();
  });

  it("says who can take it when no editor has signed in", () => {
    renderEditor(clientPool({ editors: [] }));
    expect(screen.getByText(NO_HANDOVER)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hand the pool over" })).not.toBeInTheDocument();
  });
});

describe("editors", () => {
  it("adds an editor by osu! username, and says why when osu! doesn't know the name", async () => {
    const { api, user } = renderEditor();
    const field = screen.getByRole("textbox", { name: "Add an editor" });
    api.next(() =>
      Response.json(
        { error: { code: "unknown_user", message: "osu! has no user called nobody." } },
        { status: 400 },
      ),
    );
    await user.type(field, "nobody");
    await user.click(screen.getByRole("button", { name: "Add editor" }));
    await waitFor(() =>
      expect(field).toHaveAccessibleDescription(/osu! has no user called nobody\./),
    );
    expect(field).toHaveFocus();
    const editors = [...api.pool.editors, { osuId: 2, username: "peppy" }];
    api.next(() => Response.json({ pool: { ...api.pool, editors, version: 2 } }));
    await user.clear(field);
    await user.type(field, "peppy");
    await user.click(screen.getByRole("button", { name: "Add editor" }));
    expect(await screen.findByText("peppy can edit this pool now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "peppy" })).toHaveAttribute(
      "href",
      "https://osu.ppy.sh/users/2",
    );
    expect(api.calls.at(-1)).toMatchObject({ method: "POST", body: { username: "peppy" } });
  });

  it("removes an editor after asking, then reads the pool again", async () => {
    const { api, user } = renderEditor();
    api.next(() => new Response(null, { status: 204 }));
    api.pool = { ...api.pool, editors: [], version: 2 };
    await user.click(screen.getByRole("button", { name: "Remove editor as an editor" }));
    expect(screen.getByRole("group", { name: "Remove editor as an editor?" })).toBeInTheDocument();
    expect(api.calls).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Remove" }));
    const said = await screen.findByText("editor no longer edits this pool.");
    expect(said).toHaveFocus();
    expect(screen.getByText("No editors yet.")).toBeInTheDocument();
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "DELETE /api/pools/b-a0000001/editors/20",
      "GET /api/pools/b-a0000001",
    ]);
  });
});

describe("editor layout", () => {
  it("stacks the panes, and each slot's controls unless the maps card is wide", () => {
    const { container } = renderEditor();
    const panes = container.querySelector("[data-panes]");
    expect(panes).toHaveClass("grid", "grid-cols-1");
    expect(panes?.className).toMatch(/\blg:grid-cols-\[/);
    // A slot's text and controls sit side by side only when the maps card itself is wide:
    // @haruhimemoe/ui's MapCard is its own size container, wrapping under its @2xl.
    const row = container.querySelector("li[data-map] > div");
    expect(row).toHaveClass("flex-wrap", "@2xl:flex-nowrap");
    expect(row?.className).not.toMatch(/\blg:flex-row/);
    expect(row?.closest(".\\@container")).not.toBeNull();
    const wide = [...container.querySelectorAll("*")].filter((node) =>
      /\bmin-w-\[|\bw-\[\d{3,}px\]/.test(node.getAttribute("class") ?? ""),
    );
    expect(wide).toEqual([]);
  });

  it("puts the map browser in the pool's column, under its maps, where the sliders have room", () => {
    // The page is at most 64rem wide: the 22rem side column left a slider's track 0px wide.
    const { container } = renderEditor();
    const panes = container.querySelector("[data-panes]");
    expect(panes?.className).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]");
    const [main, side] = [...(panes?.children ?? [])];
    const browser = container.querySelector("#map-browser");
    expect(browser?.parentElement).toBe(main);
    expect(side?.contains(browser as Node)).toBe(false);
    const titles = [...(main?.children ?? [])].map(
      (card) => card.querySelector("h2")?.textContent ?? "",
    );
    expect(titles.slice(0, 3)).toEqual(["Details", "Maps", "Find maps"]);
  });
});
