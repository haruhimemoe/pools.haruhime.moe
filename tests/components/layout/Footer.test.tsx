/**
 * @file tests/components/layout/Footer.test.tsx
 * @desc The footer: the pools, Data, haruhime tools (ui's column), About and Legal columns in that order
 *       with their links (Submit a pool, the /data anchors, Credits, packs, bb and the parent
 *       site, the repo, the email, the legal pages), the
 *       Discord icon link beside GitHub's, and fine print on star ratings with mods and the trademark
 *       notice but no otdb line (pools come from more than otdb; pool pages and /credits
 *       credit it).
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { FOOTER_COLUMNS, SITE } from "@/constants/site";

const EXPECTED: [string, [string, string][]][] = [
  [
    "pools",
    [
      ["Search", "/search"],
      ["Check a pool", "/check"],
      ["Submit a pool", "/submit"],
    ],
  ],
  [
    "Data",
    [
      ["Pool data", "/data#pools"],
      ["Map data", "/data#maps"],
      ["Credits", "/credits"],
    ],
  ],
  [
    "haruhime tools",
    [
      ["packs: mappool downloads", "https://packs.haruhime.moe"],
      ["bb: osu! BBCode editor", "https://bb.haruhime.moe"],
      ["All tools", "https://www.haruhime.moe"],
    ],
  ],
  [
    "About",
    [
      ["Source on GitHub", "https://github.com/haruhimemoe/pools.haruhime.moe"],
      ["contact@haruhime.moe", "mailto:contact@haruhime.moe"],
    ],
  ],
  [
    "Legal",
    [
      ["Disclaimer", "/legal/disclaimer"],
      ["Privacy", "/legal/privacy"],
      ["Terms", "/legal/terms"],
    ],
  ],
];

describe("Footer", () => {
  it("has the pools, Data, haruhime tools, About and Legal columns, in order", () => {
    // The site's own columns; ui's SiteFooter puts "haruhime tools" third.
    expect(FOOTER_COLUMNS.map((column) => column.title)).toEqual(
      EXPECTED.map(([title]) => title).filter((title) => title !== "haruhime tools"),
    );
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    const navs = within(footer).getAllByRole("navigation");
    expect(navs.map((nav) => nav.getAttribute("aria-label"))).toEqual(
      EXPECTED.map(([title]) => title),
    );
  });

  it.each(EXPECTED)("links the %s column's pages in order", (title, links) => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: title });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual(links);
  });

  it("links the Discord server with the Discord icon, before the GitHub icon", () => {
    render(<Footer />);
    const discord = screen.getByRole("link", { name: "Discord" });
    expect(discord).toHaveAttribute("href", "https://discord.gg/bKy9kjMV4y");
    expect(discord.querySelector("svg")).not.toBeNull();
    const github = screen.getByRole("link", { name: "haruhimemoe on GitHub" });
    expect(github).toHaveAttribute("href", SITE.githubOrg);
    expect(discord.compareDocumentPosition(github) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says where star ratings with mods come from, with the trademark notice and no otdb line", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByText(
        `Star ratings with mods come from the hinai mirror and can differ slightly from osu!'s. ${SITE.trademarkNotice}`,
      ),
    ).toBeInTheDocument();
    expect(footer).not.toHaveTextContent(/otdb|Sheppsu/);
  });
});
