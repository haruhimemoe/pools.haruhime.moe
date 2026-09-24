/**
 * @file tests/components/app/RootLayout.test.tsx
 * @desc Root layout frame: the Nunito variable on <html>, the dark body, a skip link first, and
 *       the page inside the #main landmark.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
