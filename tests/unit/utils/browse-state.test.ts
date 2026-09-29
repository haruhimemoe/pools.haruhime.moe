/**
 * @file tests/unit/utils/browse-state.test.ts
 * @desc The map browser's state in the editor's URL: one `browse` param holding the browser's
 *       own query (so the editor's other params are left alone), read back the same, gone when
 *       everything is at its default. And the request it makes: NM with no sort for Qualified
 *       and Pending (the lens is forced there), explicit only for those, the pool's maps left
 *       out only when "hide maps in this pool" is on.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  type BrowseState,
  browseRequestUrl,
  browseSources,
  DEFAULT_BROWSE_STATE,
  editorSearchFor,
  lensOf,
  readBrowseState,
} from "@/utils/browse-state";

const STATE: BrowseState = {
  ...DEFAULT_BROWSE_STATE,
  q: "camellia",
  lens: "HR",
  status: "loved",
  sort: "pp",
  sr: [6, 7],
  hideInPool: true,
  hidePlayed: true,
  page: 2,
};

describe("the editor's URL", () => {
  it("keeps the browser's state in one browse param, and reads it back", () => {
    const search = editorSearchFor("", STATE);
    expect(search).toBe(
      `?browse=${encodeURIComponent("lens=HR&status=loved&sort=pp&sr=6-7&hidePlayed=1&page=2&q=camellia&inPool=hide")}`,
    );
    expect(readBrowseState(search)).toEqual(STATE);
  });

  it("leaves the editor's other params alone, and drops browse at the defaults", () => {
    expect(editorSearchFor("?tab=x", { ...DEFAULT_BROWSE_STATE, lens: "DT" })).toBe(
      "?tab=x&browse=lens%3DDT",
    );
    expect(editorSearchFor("?tab=x&browse=lens%3DDT", DEFAULT_BROWSE_STATE)).toBe("?tab=x");
    expect(editorSearchFor("?browse=lens%3DDT", DEFAULT_BROWSE_STATE)).toBe("");
  });

  it("reads no browse param, or a broken one, as the defaults", () => {
    expect(readBrowseState("")).toEqual(DEFAULT_BROWSE_STATE);
    expect(readBrowseState("?browse=%%%")).toEqual(DEFAULT_BROWSE_STATE);
    expect(readBrowseState("?browse=lens%3DXX%26status%3Dany")).toEqual(DEFAULT_BROWSE_STATE);
  });
});

describe("the request", () => {
  it("sends the lens, sort and filters, and the pool's maps when they're hidden", () => {
    expect(browseRequestUrl(STATE, [30, 10, 30])).toBe(
      "/api/maps/browse?lens=HR&status=loved&sort=pp&sr=6-7&excludeIds=10,30&hidePlayed=1&page=2&q=camellia",
    );
    expect(browseRequestUrl({ ...STATE, hideInPool: false }, [10])).not.toContain("excludeIds");
  });

  it("forces NM and drops the sort for Qualified and Pending, where explicit applies", () => {
    const qualified = { ...STATE, status: "qualified" as const, explicit: true, hideInPool: false };
    expect(lensOf(qualified)).toBe("NM");
    expect(browseRequestUrl(qualified, [])).toBe(
      "/api/maps/browse?status=qualified&sr=6-7&hidePlayed=1&explicit=show&page=2&q=camellia",
    );
    expect(browseRequestUrl({ ...STATE, explicit: true }, [])).not.toContain("explicit");
    expect(lensOf(STATE)).toBe("HR");
  });
});

describe("browseSources", () => {
  it("offers Your candidates in the editor and Similar maps after a Find similar", () => {
    expect(browseSources(false, false).map((source) => source.value)).toEqual(["search"]);
    expect(browseSources(true, true).map((source) => source.value)).toEqual([
      "search",
      "candidates",
      "similar",
    ]);
    expect(browseSources(false, true).map((source) => source.label)).toEqual([
      "Search osu! maps",
      "Similar maps",
    ]);
  });
});
