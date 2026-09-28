/**
 * @file tests/components/builder/MapPreview.test.tsx
 * @desc Map previews: the set's cover from osu!'s CDN (lazy, fixed size, alt text), a play button
 *       that plays the set's clip from b.ppy.sh and stops it, only one clip at a time (starting
 *       another stops the first), a clip that ends resetting its button, and no cover or button
 *       before the set is known. Media playback is stubbed; nothing reaches the network.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapPreview } from "@/components/builder/MapPreview";
import { stopPreview } from "@/hooks/usePreviewPlayer";

let played: HTMLMediaElement[] = [];
beforeEach(() => {
  played = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    played.push(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => {
  act(() => stopPreview());
  vi.restoreAllMocks();
});

describe("MapPreview", () => {
  it("shows the set's cover, lazy and at a fixed size", () => {
    render(<MapPreview setId={1030499} song="xi - Blue Zenith" />);
    const cover = screen.getByRole("img", { name: "Cover art for xi - Blue Zenith" });
    expect(cover).toHaveAttribute("src", "https://assets.ppy.sh/beatmaps/1030499/covers/list.jpg");
    expect(cover).toHaveAttribute("loading", "lazy");
    expect(cover).toHaveAttribute("width", "48");
    expect(cover).toHaveAttribute("height", "48");
  });

  it("plays one clip at a time and stops it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MapPreview setId={1} song="A" />
        <MapPreview setId={2} song="B" />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Play preview of A" }));
    expect(played.map((audio) => audio.src)).toEqual(["https://b.ppy.sh/preview/1.mp3"]);
    await user.click(screen.getByRole("button", { name: "Play preview of B" }));
    expect(screen.getByRole("button", { name: "Play preview of A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop preview of B" })).toBeInTheDocument();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Stop preview of B" }));
    expect(screen.getByRole("button", { name: "Play preview of B" })).toBeInTheDocument();
  });

  it("resets its button when the clip ends, and waits for the set to be known", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MapPreview setId={null} song="A" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<MapPreview setId={1} song="A" />);
    await user.click(screen.getByRole("button", { name: "Play preview of A" }));
    act(() => played[0]?.dispatchEvent(new Event("ended")));
    expect(screen.getByRole("button", { name: "Play preview of A" })).toBeInTheDocument();
  });
});
