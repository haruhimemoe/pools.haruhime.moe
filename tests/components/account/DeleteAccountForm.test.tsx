/**
 * @file tests/components/account/DeleteAccountForm.test.tsx
 * @desc "Delete my account" asks for the osu! username typed in the page (no confirm() dialog):
 *       the button stays off until it matches, then one DELETE goes out with it; on success the
 *       header shows signed out and the page goes home; when packs didn't answer, the account is
 *       deleted anyway and the page says the packs' removal waits, with a link home instead; a
 *       refusal or no answer is said out loud.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";

const { push, markSignedOut } = vi.hoisted(() => ({ push: vi.fn(), markSignedOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/account", () => ({ markSignedOut }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const setup = () => {
  const user = userEvent.setup();
  render(<DeleteAccountForm username="peppy" />);
  const field = screen.getByLabelText("Type peppy to confirm");
  const button = screen.getByRole("button", { name: "Delete my account" });
  return { user, field, button };
};

describe("DeleteAccountForm", () => {
  it("stays off until the username is typed, then deletes and goes home", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { user, field, button } = setup();
    expect(button).toBeDisabled();
    await user.type(field, "Peppy");
    expect(button).toBeDisabled();
    await user.clear(field);
    await user.type(field, "peppy");
    expect(button).toBeEnabled();
    await user.click(button);
    const [url, init] = (fetchMock.mock.calls as unknown as [string, RequestInit][])[0] ?? [];
    expect(url).toBe("/api/account");
    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({ username: "peppy" });
    expect(markSignedOut).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("says the packs' removal waits when packs didn't answer, signed out, with a link home", async () => {
    const notice =
      "packs.haruhime.moe didn't answer, so 2 packs will be removed there as soon as it does.";
    vi.stubGlobal("fetch", async () => Response.json({ packRemovalsQueued: 2, notice }));
    const { user, field, button } = setup();
    await user.type(field, "peppy");
    await user.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent(
      `Your account is deleted. ${notice}`,
    );
    expect(markSignedOut).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });

  it("says why when the server refuses, or can't be reached", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: { code: "x", message: "Try again later." } }, { status: 503 }),
    );
    const { user, field, button } = setup();
    await user.type(field, "peppy");
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again later.");
    vi.stubGlobal("fetch", async () => Promise.reject(new TypeError("offline")));
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach pools. Your account is still there.",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
