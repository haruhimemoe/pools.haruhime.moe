/**
 * @file tests/components/check/CheckScreen.test.tsx
 * @desc The check page: pasted IDs are sent sorted in one request; the summary and each row's
 *       verdict, notes (https links only) and pool usage show; a damaged key shows its error and
 *       sends nothing; maps that couldn't be checked get a "Check again" button; the page always
 *       says it's guidance, not a ruling.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { encodePackKey, PACK_KEY_ERROR_MESSAGES } from "@haruhimemoe/pool";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckScreen } from "@/components/check/CheckScreen";
import type { CheckResponse } from "@/schemas/compliance";

const RULES = {
  contentUsage: "https://osu.ppy.sh/wiki/en/Rules/Content_usage_permissions",
  officialSupport: "https://osu.ppy.sh/wiki/en/Tournaments/Official_support",
  project: "https://github.com/hburn7/omc-api",
};

const ANSWER: CheckResponse = {
  sets: [
    { setId: 1, beatmapIds: [75], status: "ok", text: "Allowed", ranked: true },
    {
      setId: 102,
      beatmapIds: [1002],
      status: "potential",
      notes: "See [the list](https://example.com).",
      text: "Needs a closer look",
      ranked: false,
    },
  ],
  missing: [],
  unchecked: [555],
  maps: { "75": { label: "Kenji Ninuma - DISCOPRINCE [Normal]", count: 3, lastYear: 2023 } },
};

const fetchMock = vi.fn<(input: string) => Promise<Response>>();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json(ANSWER));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const paste = async (text: string) => {
  const user = userEvent.setup();
  render(<CheckScreen rules={RULES} />);
  await user.type(screen.getByLabelText("Maps to check"), text);
  await user.click(screen.getByRole("button", { name: "Check" }));
  return user;
};

describe("CheckScreen", () => {
  it("checks the pasted maps in one request and shows each verdict", async () => {
    await paste("1002 75 555");
    expect(await screen.findByText("1 map needs a closer look.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/check?ids=75,555,1002", expect.anything());
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Needs a closer look");
    expect(within(rows[0] as HTMLElement).getByRole("link", { name: "the list" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(rows[1]).toHaveTextContent("Kenji Ninuma - DISCOPRINCE [Normal]");
    expect(rows[1]).toHaveTextContent("Used in 3 pools (latest 2023)");
    expect(rows[2]).toHaveTextContent("Couldn't check");
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("shows a damaged key's error and sends nothing", async () => {
    const key = encodePackKey({ name: "Cup", slots: [{ mod: "NM", index: 1, beatmapId: 75 }] });
    await paste(`${key.slice(0, -3)}zzz 75`);
    expect(await screen.findByText(PACK_KEY_ERROR_MESSAGES.checksum)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("always says it's guidance, not a ruling, with the rules' links", () => {
    render(<CheckScreen rules={RULES} />);
    expect(screen.getByText(/guide, not a ruling/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "content usage permissions" })).toHaveAttribute(
      "href",
      RULES.contentUsage,
    );
    expect(screen.getByRole("link", { name: "official support" })).toHaveAttribute(
      "href",
      RULES.officialSupport,
    );
  });
});
