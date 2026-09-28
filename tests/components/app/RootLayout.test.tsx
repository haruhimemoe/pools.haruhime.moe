/**
 * @file tests/components/app/RootLayout.test.tsx
 * @desc Root layout frame: the Nunito variable on <html>, the dark body, a skip link first, the
 *       page inside the #main landmark, and the header (main nav with Submit a pool) and footer
 *       (links, legal pages, the Discord link, no-mod stars, no otdb line; the Footer test has the
 *       rest). NEXT_PUBLIC_POOLS_BETA=true adds a "beta" tag beside
 *       the wordmark (text, read once, outside the link, whose name stays "pools"); the page
 *       title template and robots don't change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Nunito: () => ({ variable: "font-nunito" }) }));

const { default: RootLayout } = await import("@/app/layout");

// <html> can't render inside a test container: render the markup and make it the page.
const renderLayout = () => {
  const markup = renderToStaticMarkup(<RootLayout>hello pools</RootLayout>);
  const parsed = new DOMParser().parseFromString(`<!doctype html>${markup}`, "text/html");
  document.replaceChild(
    document.importNode(parsed.documentElement, true),
    document.documentElement,
  );
  return within(document.body);
};

describe("RootLayout", () => {
  it("puts the Nunito variable and the dark body on the page", () => {
    renderLayout();
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveClass("font-nunito");
    expect(document.body).toHaveClass("bg-b5", "font-sans", "text-c2");
  });

  it("starts with a skip link and renders the page inside main", () => {
    const page = renderLayout();
    expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
    expect(page.getByRole("main")).toHaveTextContent("hello pools");
  });
});

describe("RootLayout header and footer", () => {
  it("links the pages, Discord and the legal pages, with no otdb line in the footer", () => {
    const page = renderLayout();
    const header = page.getByRole("banner");
    const nav = within(header).getByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Home", "/"],
      ["Search", "/search"],
      ["Check a pool", "/check"],
      ["Submit a pool", "/submit"],
    ]);
    const footer = page.getByRole("contentinfo");
    expect(within(footer).getByRole("navigation", { name: "Legal" })).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Credits" })).toHaveAttribute(
      "href",
      "/credits",
    );
    expect(within(footer).getByRole("link", { name: "Discord" })).toHaveAttribute(
      "href",
      "https://discord.gg/bKy9kjMV4y",
    );
    expect(footer).toHaveTextContent("Star ratings with mods come from the hinai mirror");
    expect(footer).not.toHaveTextContent("otdb");
  });
});

describe("RootLayout beta tag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows a beta tag beside the wordmark while NEXT_PUBLIC_POOLS_BETA is true", () => {
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", "true");
    const header = within(renderLayout().getByRole("banner"));
    const wordmark = header.getByRole("link", { name: "pools" });
    expect(wordmark).toHaveAttribute("href", "/");
    const tags = header.getAllByText("beta");
    expect(tags).toHaveLength(1);
    expect(wordmark).not.toContainElement(tags[0] ?? null);
    expect(tags[0]).not.toHaveAttribute("aria-hidden");
  });

  it.each([undefined, "", "1", "false"])("hides it for %j", (value) => {
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", value);
    const header = within(renderLayout().getByRole("banner"));
    expect(header.getByRole("link", { name: "pools" })).toBeInTheDocument();
    expect(header.queryByText("beta")).toBeNull();
  });

  it("keeps the title template and robots as they are in a beta build", async () => {
    vi.stubEnv("NEXT_PUBLIC_POOLS_BETA", "true");
    vi.resetModules();
    const { metadata } = await import("@/app/layout");
    expect(metadata.title).toEqual({
      default: "pools.haruhime.moe",
      template: "%s · pools.haruhime.moe",
    });
    expect(metadata.robots).toBeUndefined();
  });
});
