/**
 * @file tests/components/builder/PackPanel.test.tsx
 * @desc The editor's "Pack on packs": a private pool has none and no button (the owner is told
 *       to share it, an editor that the owner can); an empty shared pool is told to add a map; a
 *       pack links to packs while there's one, pending included; a failed one gives packs'
 *       reason, and a refusal says the next change sends it again; one packs removed has no
 *       button and says it stays off packs, private or not. "Update pack now" posts to the
 *       pool's pack route and announces the state that comes back, or why it was refused. The
 *       editor's poll takes a pack state that moved on without a new version.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PACK_STATUS_TEXT } from "@/constants/built-pools";
import type { ClientPack } from "@/schemas/built-pool-view";
import { clientPool, EDITOR_ACCESS } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const HREF = "https://packs.haruhime.moe/p/Abc123";
const pack = (over: Partial<ClientPack> = {}): ClientPack => ({
  state: "pending",
  href: null,
  error: null,
  gone: false,
  retry: true,
  ...over,
});
const panel = () =>
  screen.getByRole("heading", { name: "Pack on packs" }).parentElement as HTMLElement;
const update = () => within(panel()).queryByRole("button", { name: "Update pack now" });

describe("PackPanel", () => {
  it("says a private pool has no pack, with no button", () => {
    const { unmount } = renderEditor();
    expect(within(panel()).getByText(PACK_STATUS_TEXT.private)).toBeInTheDocument();
    expect(update()).toBeNull();
    unmount();
    // Only the owner changes who sees a pool.
    renderEditor(clientPool({ access: EDITOR_ACCESS }));
    expect(within(panel()).getByText(PACK_STATUS_TEXT.privateEditor)).toBeInTheDocument();
  });

  it("tells an empty shared pool to add a map", () => {
    renderEditor(clientPool({ visibility: "public", slots: [], pack: pack({ state: "none" }) }));
    expect(within(panel()).getByText(PACK_STATUS_TEXT.empty)).toBeInTheDocument();
    expect(update()).toBeNull();
  });

  it("links a synced pack, and gives packs' reason for a failed one", () => {
    const synced = clientPool({
      visibility: "public",
      pack: pack({ state: "synced", href: HREF }),
    });
    const { unmount } = renderEditor(synced);
    expect(within(panel()).getByText(PACK_STATUS_TEXT.synced)).toBeInTheDocument();
    expect(within(panel()).getByRole("link", { name: "Open the pack on packs" })).toHaveAttribute(
      "href",
      HREF,
    );
    unmount();
    const failed = pack({ state: "failed", error: "packs answered 503." });
    renderEditor(clientPool({ visibility: "unlisted", pack: failed, access: EDITOR_ACCESS }));
    expect(
      within(panel()).getByText(`${PACK_STATUS_TEXT.failed} packs answered 503.`),
    ).toBeInTheDocument();
    expect(update()).toBeEnabled();
  });

  it("links the pack while a change waits, and says a refusal waits for a change", () => {
    const waiting = clientPool({ visibility: "public", pack: pack({ href: HREF }) });
    const { unmount } = renderEditor(waiting);
    expect(within(panel()).getByRole("link", { name: "Open the pack on packs" })).toBeVisible();
    unmount();
    const refused = pack({ state: "failed", error: "packs refused it (400): No.", retry: false });
    renderEditor(clientPool({ visibility: "public", pack: refused }));
    const text = `${PACK_STATUS_TEXT.failed} packs refused it (400): No. ${PACK_STATUS_TEXT.refused}`;
    expect(within(panel()).getByText(text)).toBeInTheDocument();
  });

  it("has no button once packs removed the pack, and says so even when private", () => {
    const gone = pack({ state: "failed", error: "packs removed this pool's pack.", gone: true });
    const { unmount } = renderEditor(clientPool({ visibility: "public", pack: gone }));
    expect(update()).toBeNull();
    expect(within(panel()).getByText(PACK_STATUS_TEXT.gone)).toBeInTheDocument();
    unmount();
    renderEditor(clientPool({ pack: pack({ state: "none", gone: true }) }));
    expect(within(panel()).getByText(PACK_STATUS_TEXT.gone)).toBeInTheDocument();
  });

  it("updates the pack now and shows what came back, or why not", async () => {
    const { api, user } = renderEditor(clientPool({ visibility: "public", pack: pack() }));
    expect(within(panel()).getByText(PACK_STATUS_TEXT.pending)).toBeInTheDocument();
    api.next(() =>
      Response.json(
        { error: { code: "packs_unavailable", message: "packs isn't set up here." } },
        { status: 503 },
      ),
    );
    await user.click(update() as HTMLElement);
    expect(await within(panel()).findByText("packs isn't set up here.")).toBeInTheDocument();
    api.next(() =>
      Response.json({ pool: { ...api.pool, pack: pack({ state: "synced", href: HREF }) } }),
    );
    await user.click(update() as HTMLElement);
    // Announced, not only shown: the status line isn't a live region.
    expect(await within(panel()).findByRole("status")).toHaveTextContent(PACK_STATUS_TEXT.synced);
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /api/pools/b-a0000001/pack",
      "POST /api/pools/b-a0000001/pack",
    ]);
  });

  it("takes a pack state the poll finds on the same version", async () => {
    const { api } = renderEditor(clientPool({ visibility: "public", pack: pack() }), {
      pollMs: 20,
    });
    api.pool = { ...api.pool, pack: pack({ state: "synced", href: HREF }) };
    expect(await within(panel()).findByText(PACK_STATUS_TEXT.synced)).toBeInTheDocument();
  });
});
