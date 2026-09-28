/**
 * @file tests/components/builder/OwnerPanel.test.tsx
 * @desc Who manages the pool: the owner's settings (visibility with the pack note only when it
 *       matters, adding and removing editors, delete behind the typed name) and none of them for
 *       an editor, who can leave instead. When packs didn't answer, deleting or going private
 *       still works and says the pack's removal waits. Requests take turns with the ops, so the next change
 *       carries the version they moved to. Also the editor's layout at phone width, by class.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PACK_NOTE, PACK_REMOVAL_QUEUED } from "@/constants/built-pools";
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

  it("delete only once the pool's name is typed, then goes to Your pools", async () => {
    const { api, user } = renderEditor();
    const confirm = screen.getByRole("textbox", { name: "Type Spring Cup Finals to confirm" });
    const remove = screen.getByRole("button", { name: "Delete this pool" });
    expect(remove).toBeDisabled();
    await user.type(confirm, "spring cup finals");
    expect(remove).toBeDisabled();
    api.next(() => Response.json({ error: { message: "packs didn't answer." } }, { status: 502 }));
    await user.clear(confirm);
    await user.type(confirm, "Spring Cup Finals");
    await user.click(remove);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "packs didn't answer. The pool is still there.",
    );
    expect(push).not.toHaveBeenCalled();
    await user.click(remove);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/account#pools"));
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "DELETE /api/pools/b-a0000001",
      "DELETE /api/pools/b-a0000001",
    ]);
  });

  it("says the pack's removal waits when a delete went through without packs", async () => {
    const { api, user } = renderEditor();
    api.next(() => Response.json({ packRemoval: "queued", notice: PACK_REMOVAL_QUEUED }));
    await user.type(
      screen.getByRole("textbox", { name: "Type Spring Cup Finals to confirm" }),
      "Spring Cup Finals",
    );
    await user.click(screen.getByRole("button", { name: "Delete this pool" }));
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

  it("removes an editor, then reads the pool again", async () => {
    const { api, user } = renderEditor();
    api.next(() => new Response(null, { status: 204 }));
    api.pool = { ...api.pool, editors: [], version: 2 };
    await user.click(screen.getByRole("button", { name: "Remove editor as an editor" }));
    expect(await screen.findByText("editor no longer edits this pool.")).toBeInTheDocument();
    expect(screen.getByText("No editors yet.")).toBeInTheDocument();
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "DELETE /api/pools/b-a0000001/editors/20",
      "GET /api/pools/b-a0000001",
    ]);
  });
});

describe("editor layout", () => {
  it("stacks the panes and each slot's controls on phones", () => {
    const { container } = renderEditor();
    const panes = container.querySelector("[data-panes]");
    expect(panes).toHaveClass("grid", "grid-cols-1");
    expect(panes?.className).toMatch(/\blg:grid-cols-\[/);
    const row = container.querySelector("li[data-map]");
    expect(row).toHaveClass("flex-col", "lg:flex-row");
    const wide = [...container.querySelectorAll("*")].filter((node) =>
      /\bmin-w-\[|\bw-\[\d{3,}px\]/.test(node.getAttribute("class") ?? ""),
    );
    expect(wide).toEqual([]);
  });
});
