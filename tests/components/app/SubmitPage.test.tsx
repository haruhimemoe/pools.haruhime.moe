/**
 * @file tests/components/app/SubmitPage.test.tsx
 * @desc /submit: text, not a form (pools has no public writes). Hosts and community members
 *       post in the Discord server or email contact@haruhime.moe with the tournament, round,
 *       year, a forum or sheet link and the maps (a packs link is easiest); an admin checks
 *       every pool by hand before it appears.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SubmitPage, { metadata } from "@/app/submit/page";

describe("/submit", () => {
  it("is titled and has no form or fields", () => {
    const { container } = render(<SubmitPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Submit a pool" })).toBeInTheDocument();
    expect(container.querySelector("form, input, textarea, select, button")).toBeNull();
  });

  it("sends hosts and community members to Discord or email", () => {
    const { container } = render(<SubmitPage />);
    expect(container).toHaveTextContent(/tournament hosts and community members/i);
    expect(screen.getAllByRole("link", { name: "Discord server" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "contact@haruhime.moe" }).length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("link", { name: "Discord server" })) {
      expect(link).toHaveAttribute("href", "https://discord.gg/bKy9kjMV4y");
    }
    for (const link of screen.getAllByRole("link", { name: "contact@haruhime.moe" })) {
      expect(link).toHaveAttribute("href", "mailto:contact@haruhime.moe");
    }
  });

  it("lists what to include, with a packs link as the easiest way to send the maps", () => {
    render(<SubmitPage />);
    const include = screen.getByRole("region", { name: "What to include" });
    const items = within(include)
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    for (const part of [/^The tournament/, /^The round/, /^The year/, /forum post or sheet/]) {
      expect(items.some((item) => part.test(item))).toBe(true);
    }
    expect(items.some((item) => /maps/i.test(item) && /packs link is easiest/i.test(item))).toBe(
      true,
    );
    expect(within(include).getByRole("link", { name: "packs.haruhime.moe" })).toHaveAttribute(
      "href",
      "https://packs.haruhime.moe",
    );
  });

  it("says pools are checked by hand before they appear", () => {
    render(<SubmitPage />);
    expect(screen.getByRole("region", { name: "What happens next" })).toHaveTextContent(
      /checks every pool by hand before it appears/i,
    );
  });

  it("has a title and a description", () => {
    expect(metadata.title).toBe("Submit a pool");
    expect(metadata.description).toMatch(/Discord/);
  });

  it("uses no em dashes", () => {
    const { container } = render(<SubmitPage />);
    expect(container.textContent).not.toContain("—");
  });
});
