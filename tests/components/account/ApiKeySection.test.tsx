/**
 * @file tests/components/account/ApiKeySection.test.tsx
 * @desc After creating a key, the revealed field is a CopyField: its Copy button is described by
 *       the field's label (never the input, whose value would be read out), and the revealed
 *       input still takes focus.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiKeySection } from "@/components/account/ApiKeySection";

const createFetcher = () =>
  vi.fn(async () =>
    Response.json({
      apiKey: { prefix: "hpl_abc", createdAt: "2026-10-01T00:00:00Z", lastUsedAt: null },
      key: "hpl_abcdefghijklmnop",
    }),
  ) as unknown as typeof fetch;

describe("ApiKeySection", () => {
  it("reveals the new key on a CopyField, Copy described by the label, focused on the input", async () => {
    const user = userEvent.setup();
    render(<ApiKeySection initial={null} fetcher={createFetcher()} />);
    await user.click(screen.getByRole("button", { name: "Create API key" }));

    const input = await screen.findByLabelText("Your new API key");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("hpl_abcdefghijklmnop");

    const copyButton = screen.getByRole("button", { name: "Copy" });
    const describedBy = copyButton.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent("Your new API key");
    expect(copyButton.getAttribute("aria-describedby")).not.toBe(input.id);
  });
});
