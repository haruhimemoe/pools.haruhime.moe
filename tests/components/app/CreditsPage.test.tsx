/**
 * @file tests/components/app/CreditsPage.test.tsx
 * @desc /credits keeps otdb's credit (by Sheppsu, his public export, used with his permission)
 *       for the pools that came from it, thanks the tournament hosts and community members who
 *       send pools in general terms (credited unless they asked not to be named), links
 *       /submit, says map details come from the hinai mirror (osu! API data; a map it doesn't
 *       have keeps its source's), and no longer says every pool comes from otdb.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Sep 26, 2026
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CreditsPage from "@/app/credits/page";

describe("/credits", () => {
  it("credits otdb by Sheppsu for the pools that came from it", () => {
    const { container } = render(<CreditsPage />);
    expect(screen.getByRole("link", { name: "otdb" })).toHaveAttribute(
      "href",
      "https://otdb.sheppsu.me",
    );
    expect(container).toHaveTextContent("by Sheppsu");
    expect(container).toHaveTextContent("used with his permission");
  });

  it("credits tournament hosts and community members, and links sending a pool", () => {
    const { container } = render(<CreditsPage />);
    expect(container).toHaveTextContent(/tournament hosts/i);
    expect(container).toHaveTextContent(/community members/i);
    expect(screen.getByRole("link", { name: "Submit a pool" })).toHaveAttribute("href", "/submit");
    expect(container).toHaveTextContent(
      "each pool page credits who sent it, unless they asked not to be named",
    );
  });

  it("says map details come from the hinai mirror, which serves osu! API data", () => {
    const { container } = render(<CreditsPage />);
    expect(screen.getByRole("link", { name: "hinai mirror" })).toHaveAttribute(
      "href",
      "https://mirror.hinamizawa.ai",
    );
    expect(container).toHaveTextContent("which serves osu! API data");
    expect(container).toHaveTextContent(
      "A map the mirror doesn't have keeps what its source gave.",
    );
  });

  it("doesn't say every pool comes from otdb", () => {
    const { container } = render(<CreditsPage />);
    expect(container).not.toHaveTextContent(/every pool comes from/i);
    expect(container.textContent).not.toContain("—");
  });
});
