/**
 * @file tests/components/history/History.test.tsx
 * @desc HistoryTable marks the current row and links each revision; RevertButton confirms, posts
 *       and navigates, or shows a refusal; HistoryVisibilityForm PUTs the right body and rolls
 *       back on a failure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryTable } from "@/components/history/HistoryTable";
import { HistoryVisibilityForm } from "@/components/history/HistoryVisibilityForm";
import { RevertButton } from "@/components/history/RevertButton";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => vi.clearAllMocks());

const revision = (over: Partial<Parameters<typeof HistoryTable>[0]["revisions"][0]> = {}) => ({
  id: "r1",
  docId: "b-a0000001",
  seq: 0,
  kind: "root" as const,
  valueHash: "x",
  authorId: "owner",
  authorName: "owner",
  message: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

describe("HistoryTable", () => {
  it("marks the current row and links each revision", () => {
    const revisions = [
      revision({ id: "r2", seq: 1, kind: "save", authorName: "editor" }),
      revision({ id: "r1", seq: 0 }),
    ];
    render(<HistoryTable poolId="b-a0000001" revisions={revisions} selected="r2" older={null} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    const current = links.find((link) => link.getAttribute("aria-current") === "true");
    expect(current).toHaveAttribute("href", "/pools/b-a0000001/history?rev=r2");
    expect(screen.getByText("editor")).toBeInTheDocument();
  });

  it("links an older page when there's a next one", () => {
    render(<HistoryTable poolId="b-a0000001" revisions={[revision()]} selected="r1" older={0} />);
    expect(screen.getByRole("link", { name: "Older versions" })).toHaveAttribute(
      "href",
      "/pools/b-a0000001/history?before=0",
    );
  });
});

describe("RevertButton", () => {
  it("confirms, posts and navigates on success", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () => Response.json({ pool: {} }));
    render(<RevertButton poolId="b-a0000001" revisionId="r1" fetcher={fetcher} />);
    await user.click(screen.getByRole("button", { name: "Restore this version" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/pools/b-a0000001/history/r1/revert",
      expect.objectContaining({ method: "POST" }),
    );
    expect(push).toHaveBeenCalledWith("/pools/b-a0000001/edit");
  });

  it("shows a refusal in the live notice", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () =>
      Response.json({ error: { code: "forbidden", message: "Not allowed." } }, { status: 403 }),
    );
    render(<RevertButton poolId="b-a0000001" revisionId="r1" fetcher={fetcher} />);
    await user.click(screen.getByRole("button", { name: "Restore this version" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Not allowed.")).toBeInTheDocument();
  });
});

describe("HistoryVisibilityForm", () => {
  it("PUTs the right body when changed", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () => Response.json({ pool: {} }));
    render(<HistoryVisibilityForm poolId="b-a0000001" historyPublic={false} fetcher={fetcher} />);
    await user.click(screen.getByRole("radio", { name: "Anyone who can see the pool" }));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/pools/b-a0000001/history",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ historyPublic: true }),
      }),
    );
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("rolls back the control on a refusal", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () =>
      Response.json({ error: { code: "forbidden", message: "Not allowed." } }, { status: 403 }),
    );
    render(<HistoryVisibilityForm poolId="b-a0000001" historyPublic={false} fetcher={fetcher} />);
    await user.click(screen.getByRole("radio", { name: "Anyone who can see the pool" }));
    expect(await screen.findByText("Not allowed.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Owner and editors" })).toBeChecked();
  });
});
