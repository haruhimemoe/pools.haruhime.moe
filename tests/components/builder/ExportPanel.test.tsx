/**
 * @file tests/components/builder/ExportPanel.test.tsx
 * @desc Export on a pool's page and in the editor: Copy beatmap IDs and Copy !mp lines put the
 *       text on the clipboard, and Download CSV saves a file made in the browser from what the
 *       page holds (no request). An empty pool has nothing to export.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportPanel } from "@/components/builder/ExportPanel";
import { csvOf, exportRows } from "@/utils/pool-export";
import { clientPool, mapsFor } from "../../helpers/pool-editor";

afterEach(() => vi.restoreAllMocks());

describe("ExportPanel", () => {
  it("copies the IDs and the !mp lines", async () => {
    const user = userEvent.setup();
    render(<ExportPanel pool={clientPool()} maps={mapsFor([10, 20, 30])} values={{}} />);
    await user.click(screen.getByRole("button", { name: "Copy beatmap IDs" }));
    expect(await navigator.clipboard.readText()).toBe("NM1 10\nNM2 20\nNM3 30");
    await user.click(screen.getByRole("button", { name: "Copy !mp lines" }));
    expect(await navigator.clipboard.readText()).toMatch(/^!mp map 10 0\n!mp mods None\n\n/);
  });

  it("downloads the CSV made in the browser, marked UTF-8, and lets the download start", async () => {
    const user = userEvent.setup();
    const later = vi.spyOn(window, "setTimeout");
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:csv";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const atClick: { connected: boolean; revoked: boolean }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      atClick.push({
        connected: this.isConnected,
        revoked: vi.mocked(URL.revokeObjectURL).mock.calls.length > 0,
      });
    });
    const pool = clientPool();
    const maps = mapsFor([10, 20, 30]);
    render(<ExportPanel pool={pool} maps={maps} values={{}} />);
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("spring-cup-finals.csv");
    expect(atClick).toEqual([{ connected: true, revoked: false }]);
    expect(anchor.isConnected).toBe(false);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    const revoke = later.mock.calls.find(([, ms]) => (ms ?? 0) >= 10_000)?.[0];
    expect(revoke).toBeTypeOf("function");
    (revoke as () => void)();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    const bytes = new Uint8Array(await (blobs[0] as Blob).arrayBuffer());
    // A byte order mark, so Excel reads the file as UTF-8 (osu! titles are often Japanese).
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toBe(csvOf(exportRows(pool, maps, {})));
  });

  it("has nothing to export for an empty pool", () => {
    render(<ExportPanel pool={clientPool({ slots: [] })} maps={{}} values={{}} />);
    expect(screen.getByText("Add maps to export them.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
