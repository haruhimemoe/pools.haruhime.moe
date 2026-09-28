/**
 * @file tests/components/layout/AccountMenu.test.tsx
 * @desc The header's account area: nothing while loading, "Sign in" (back to this page after)
 *       when signed out, and when signed in an avatar button that opens a menu with Make a pool,
 *       Your pools, Account and Sign out, closed again by Escape (focus back on the button) or a
 *       second press.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/layout/AccountMenu";
import type { Account } from "@/lib/account";

const { account } = vi.hoisted(() => ({
  account: { current: { status: "loading" } as Account },
}));
vi.mock("@/lib/account", () => ({ useAccount: () => account.current }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const SIGNED_IN: Account = {
  status: "signed-in",
  user: { id: "u1", username: "peppy", avatarUrl: "https://a.ppy.sh/2" },
};

describe("AccountMenu", () => {
  it("shows nothing to press while loading", () => {
    account.current = { status: "loading" };
    render(<AccountMenu />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers sign in, coming back to this page", () => {
    account.current = { status: "signed-out" };
    render(<AccountMenu />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin?next=%2Fsearch",
    );
  });

  it("opens a menu with Make a pool, Your pools, Account and Sign out", async () => {
    account.current = SIGNED_IN;
    const user = userEvent.setup();
    const { container } = render(<AccountMenu />);
    const button = screen.getByRole("button", { name: "peppy" });
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Make a pool" })).toHaveAttribute("href", "/new");
    expect(screen.getByRole("link", { name: "Your pools" })).toHaveAttribute(
      "href",
      "/account#pools",
    );
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(button);
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
  });
});
