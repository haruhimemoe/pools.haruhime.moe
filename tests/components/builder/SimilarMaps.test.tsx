/**
 * @file tests/components/builder/SimilarMaps.test.tsx
 * @desc Find similar in the map browser and the editor: a result's Find similar opens "Similar to
 *       <map>" under the lens (the URL the route reads), with the method, BoBERT's credit and each
 *       difficulty's similarity; Back to search returns to the search; a difficulty match says
 *       so; "Leaderboard maps only" is on by default, says what it left out and stays off in the
 *       browse state once turned off; a failure has Retry; and a slot's Find similar in the editor opens the browser's
 *       source for that map with the pool's id, while a pool's page shows no Find similar.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindSimilarButton } from "@/components/builder/FindSimilarButton";
import {
  BOBERT_CREDIT,
  SIMILAR_LEADERBOARD_LABEL,
  SIMILAR_METHOD_TEXT,
  similarUnrankedText,
} from "@/constants/similar";
import type { SimilarSet } from "@/utils/similar-params";
import { diff, lensAsked, renderPane, set } from "../../helpers/browse-pane";
import { browsePage, similarPage } from "../../helpers/pool-editor";
import { renderEditor } from "../../helpers/render-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const SIMILAR_SET: SimilarSet = set(7, []) as SimilarSet;
SIMILAR_SET.diffs = [{ ...diff(71), similarity: 93 }];

const answering =
  (similar: (url: URL) => Response) =>
  (url: URL): Response =>
    url.pathname.endsWith("/similar")
      ? similar(url)
      : Response.json(browsePage({ lens: lensAsked(url), sets: [set(1, [diff(11), diff(12)])] }));

describe("Similar maps in the map browser", () => {
  it("opens from a result under the lens, with the method, credit and similarity", async () => {
    const { user, urls } = renderPane({
      answer: answering((url) =>
        Response.json(similarPage({ id: 12, lens: lensAsked(url), sets: [SIMILAR_SET] })),
      ),
    });
    await user.click(
      await screen.findByRole("button", { name: "Find similar: xi - Song 1 [Diff 12]" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Similar to xi - Song 1 [Diff 12]" }),
    ).toBeVisible();
    expect(await screen.findByText("93% similar")).toBeVisible();
    expect(screen.getByText(SIMILAR_METHOD_TEXT.pattern.label)).toBeVisible();
    expect(screen.getByRole("link", { name: BOBERT_CREDIT.name })).toHaveAttribute(
      "href",
      BOBERT_CREDIT.url,
    );
    expect(urls.at(-1)?.pathname).toBe("/api/maps/12/similar");
    expect(screen.getByRole("radio", { name: "Similar maps" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Back to search" }));
    expect(
      await screen.findByRole("button", { name: "Find similar: xi - Song 1 [Diff 11]" }),
    ).toBeVisible();
    expect(screen.queryByText("93% similar")).toBeNull();
  });

  it("asks for leaderboard maps only by default, says what it left out, and keeps a switch-off in the URL", async () => {
    window.history.replaceState(null, "", "/pools/b-a0000001/edit");
    const { user, urls } = renderPane({
      answer: answering((url) =>
        Response.json(
          similarPage({
            id: 12,
            sets: [SIMILAR_SET],
            ...(url.searchParams.get("status") === "leaderboard"
              ? { unranked: 12, total: 20 }
              : {}),
            total: 20,
          }),
        ),
      ),
    });
    await user.click(
      await screen.findByRole("button", { name: "Find similar: xi - Song 1 [Diff 12]" }),
    );
    const box = await screen.findByRole("checkbox", { name: SIMILAR_LEADERBOARD_LABEL });
    expect(box).toBeChecked();
    expect(urls.at(-1)?.searchParams.get("status")).toBe("leaderboard");
    expect(await screen.findByText(similarUnrankedText(12, 20, 1))).toBeVisible();
    await user.click(box);
    await vi.waitFor(() => expect(urls.at(-1)?.searchParams.get("status")).toBeNull());
    expect(
      await screen.findByRole("checkbox", { name: SIMILAR_LEADERBOARD_LABEL }),
    ).not.toBeChecked();
    await vi.waitFor(() =>
      expect(new URLSearchParams(window.location.search).get("browse")).toBe("similar=all"),
    );
    expect(screen.queryByText(/no leaderboard/)).toBeNull();
  });

  it("says when it's a difficulty match, and offers Retry after a failure", async () => {
    let fail = true;
    const { user } = renderPane({
      answer: answering(() =>
        fail
          ? Response.json(
              {
                error: {
                  code: "similar_unavailable",
                  message: "Similar maps aren't available right now.",
                },
              },
              { status: 503 },
            )
          : Response.json(similarPage({ method: "difficulty", rev: null })),
      ),
    });
    await user.click(
      await screen.findByRole("button", { name: "Find similar: xi - Song 1 [Diff 11]" }),
    );
    expect(await screen.findByText("Similar maps aren't available right now.")).toBeVisible();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(SIMILAR_METHOD_TEXT.difficulty.label)).toBeVisible();
    expect(screen.getByText(/No similar maps left/)).toBeVisible();
  });
});

describe("Find similar in the editor", () => {
  it("opens the browser's source for a slot's map, leaving the pool's maps out", async () => {
    const { api, user } = renderEditor();
    const slot = document.querySelector<HTMLElement>('li[data-map="20"]');
    if (!slot) throw new Error("no slot");
    await user.click(within(slot).getByRole("button", { name: /^Find similar: / }));
    expect(await screen.findByRole("heading", { name: /^Similar to / })).toBeVisible();
    expect(api.similarCalls.at(-1)?.pathname).toBe("/api/maps/20/similar");
    expect(api.similarCalls.at(-1)?.searchParams.get("pool")).toBe("b-a0000001");
  });

  it("shows no Find similar without a handler above it", () => {
    render(<FindSimilarButton beatmapId={1} label="xi - FREEDOM DiVE [FOUR DIMENSIONS]" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
