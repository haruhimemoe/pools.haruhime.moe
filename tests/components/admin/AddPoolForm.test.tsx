/**
 * @file tests/components/admin/AddPoolForm.test.tsx
 * @desc The add-a-pool form sends its fields to POST /api/admin/pools as JSON (an empty year as
 *       unknown, badged as null, true or false), then links the pool it created or the one the
 *       maps joined ("already in", or already credited), with what happened to the pack, and
 *       empties itself; a year that isn't four digits is refused beside its field and nothing is
 *       sent; a refused save puts each error beside its field; a failed request says so; the
 *       name hint offers "a community member" for a sender who'd rather not be named.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Oct 3, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddPoolForm } from "@/components/admin/AddPoolForm";

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const fill = async () => {
  const user = userEvent.setup();
  render(<AddPoolForm />);
  await user.selectOptions(screen.getByLabelText("Sent by"), "community");
  await user.type(screen.getByLabelText("Name to credit"), "peppy");
  await user.type(screen.getByLabelText("Credit link"), "https://osu.ppy.sh/users/2");
  await user.type(screen.getByLabelText("Tournament"), "Spring Cup");
  await user.type(screen.getByLabelText("Round"), "Finals");
  await user.selectOptions(screen.getByLabelText("Badged tournament"), "yes");
  await user.type(screen.getByLabelText("Maps"), "NM1 129891");
  await user.click(screen.getByRole("button", { name: "Add pool" }));
  return user;
};

describe("AddPoolForm", () => {
  it("sends the fields and links the pool it created", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json(
        {
          outcome: "created",
          revived: false,
          pool: {
            id: "community-ca1b2c3d",
            name: "Spring Cup Finals",
            href: "/admin/pools/community-ca1b2c3d",
          },
          maps: { added: 1, asked: 1, filled: 1, missing: 0, error: null },
          sync: { status: "sent", state: "created", error: null },
        },
        { status: 201 },
      ),
    );
    await fill();
    expect(await screen.findByRole("link", { name: "Spring Cup Finals" })).toHaveAttribute(
      "href",
      "/admin/pools/community-ca1b2c3d",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Added Spring Cup Finals. packs made its pack.",
    );
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/admin/pools");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: "community",
      creditName: "peppy",
      creditUrl: "https://osu.ppy.sh/users/2",
      tournament: "Spring Cup",
      round: "Finals",
      year: null,
      badged: true,
      notes: "",
      maps: "NM1 129891",
    });
    // Emptied, so a second click can't add the same pool again.
    expect(screen.getByLabelText("Name to credit")).toHaveValue("");
    expect(screen.getByLabelText("Maps")).toHaveValue("");
    expect(screen.getByLabelText("Sent by")).toHaveValue("host");
  });

  it("says when the pool already credits the sender, and adds nothing", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        outcome: "merged",
        revived: false,
        alreadyCredited: true,
        pool: { id: "otdb-657", name: "OWC 2023 GF", href: "/admin/pools/otdb-657" },
        maps: { added: 0, asked: 0, filled: 0, missing: 0, error: null },
        sync: { status: "not-needed" },
      }),
    );
    await fill();
    await screen.findByRole("link", { name: "OWC 2023 GF" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "These maps are already in OWC 2023 GF, which already credits this sender with this link, so nothing was added.",
    );
  });

  it("refuses a year that isn't four digits beside its field, sending nothing", async () => {
    const user = userEvent.setup();
    render(<AddPoolForm />);
    await user.type(screen.getByLabelText("Year"), "20x6");
    await user.click(screen.getByRole("button", { name: "Add pool" }));
    expect(screen.getByLabelText("Year")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/four digits/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers a community member as the name for a sender who'd rather not be named", () => {
    render(<AddPoolForm />);
    expect(screen.getByText(/Write "a community member" when the sender/)).toBeInTheDocument();
  });

  it("names the pool the maps joined, and says the form's other fields were left out", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        outcome: "merged",
        revived: true,
        pool: { id: "otdb-657", name: "OWC 2023 GF", href: "/admin/pools/otdb-657" },
        maps: { added: 0, asked: 0, filled: 0, missing: 0, error: null },
        sync: { status: "failed", message: "POOLS_SERVICE_TOKEN isn't set." },
      }),
    );
    await fill();
    expect(await screen.findByRole("link", { name: "OWC 2023 GF" })).toHaveAttribute(
      "href",
      "/admin/pools/otdb-657",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "These maps are already in OWC 2023 GF, so the source joined it and it's back from superseded. Its name, round, year and notes stay as they were: edit them there. The pack wasn't sent: POOLS_SERVICE_TOKEN isn't set.",
    );
  });

  it("puts each error beside its field", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json(
        {
          error: {
            code: "bad_request",
            message: "Use an https link, or leave it empty.",
            fields: {
              creditUrl: "Use an https link, or leave it empty.",
              maps: "Line 2: NM1 appears more than once.",
            },
          },
        },
        { status: 400 },
      ),
    );
    await fill();
    expect(await screen.findByText("Line 2: NM1 appears more than once.")).toBeInTheDocument();
    expect(screen.getByLabelText("Maps")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Credit link")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Tournament")).not.toHaveAttribute("aria-invalid", "true");
    // The field errors are status messages too (ui 0.7.0), so pick the form's own output by text.
    expect(screen.getByText("Fix the fields marked above.").tagName).toBe("OUTPUT");
  });

  it("says when the request didn't reach the server", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await fill();
    expect(
      await screen.findByText("The pool wasn't added: the request didn't reach the server."),
    ).toBeInTheDocument();
  });
});
