/**
 * @file tests/components/builder/NewPoolForm.test.tsx
 * @desc "Make a pool": a missing name or a year that isn't one is said under its field (focus
 *       goes there) with nothing sent; a good form POSTs the name and every detail (an empty one
 *       as "" or a null year), then goes to the new pool's editor, with the template picked (its targets, never maps); a refusal is said in the page.
 *       Starting from a pool fills in its details, says how many maps come with it, sends
 *       startedFrom, and sends a detail cleared from it as empty.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewPoolForm } from "@/components/builder/NewPoolForm";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => vi.clearAllMocks());

const START = {
  id: "otdb-9",
  name: "OWC 2023 Finals",
  tournament: "osu! World Cup",
  round: "Finals",
  year: 2023,
  maps: 12,
};

const setup = (answer: () => Response, startFrom?: typeof START) => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => answer());
  const user = userEvent.setup();
  render(
    <NewPoolForm
      fetcher={fetcher as unknown as typeof fetch}
      {...(startFrom ? { startFrom } : {})}
    />,
  );
  const field = (name: string) => screen.getByRole("textbox", { name });
  const make = () => user.click(screen.getByRole("button", { name: "Make the pool" }));
  return { fetcher, user, field, make };
};

describe("NewPoolForm", () => {
  it("says what's missing and sends nothing", async () => {
    const { fetcher, user, field, make } = setup(() => Response.json({ id: "b-a0000001" }));
    await user.type(field("Year"), "next year");
    await make();
    expect(field("Name")).toHaveAccessibleDescription(/Give the pool a name\./);
    expect(field("Name")).toHaveFocus();
    expect(field("Year")).toHaveAccessibleDescription(/A year is a whole number\./);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("makes the pool and opens its editor", async () => {
    const { fetcher, user, field, make } = setup(() =>
      Response.json({ id: "b-a0000001" }, { status: 201 }),
    );
    await user.type(field("Name"), " Spring Cup Finals ");
    await user.type(field("Tournament"), "Spring Cup");
    await user.type(field("Year"), "2026");
    await make();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/pools/b-a0000001/edit"));
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("/api/pools");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Spring Cup Finals",
      tournament: "Spring Cup",
      round: "",
      year: 2026,
    });
  });

  it("sends the template picked, and none for Blank", async () => {
    const { fetcher, user, field, make } = setup(() =>
      Response.json({ id: "b-a0000001" }, { status: 201 }),
    );
    const picker = screen.getByRole("combobox", { name: "Template" });
    expect(picker).toHaveValue("blank");
    await user.selectOptions(picker, "Finals (7 NM, 4 HD, 4 HR, 5 DT, 4 FM, 1 TB)");
    await user.type(field("Name"), "Cup");
    await make();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      name: "Cup",
      template: "finals",
    });
  });

  it("says why the server refused", async () => {
    const message = "You can own at most 50 pools. Delete one to make another.";
    const { field, make, user } = setup(() =>
      Response.json({ error: { code: "too_many_pools", message } }, { status: 400 }),
    );
    await user.type(field("Name"), "One more");
    await make();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(push).not.toHaveBeenCalled();
  });

  it("starts from a pool: its details filled in, its maps copied", async () => {
    const { fetcher, user, field, make } = setup(
      () => Response.json({ id: "b-a0000002" }, { status: 201 }),
      START,
    );
    expect(screen.getByText("It starts with the 12 maps of OWC 2023 Finals.")).toBeInTheDocument();
    expect(field("Name")).toHaveValue("OWC 2023 Finals");
    expect(field("Year")).toHaveValue("2023");
    await user.clear(field("Name"));
    await user.type(field("Name"), "My OWC");
    await make();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/pools/b-a0000002/edit"));
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      name: "My OWC",
      tournament: "osu! World Cup",
      round: "Finals",
      year: 2023,
      startedFrom: "otdb-9",
    });
    expect(screen.queryByRole("combobox", { name: "Template" })).toBeNull();
  });

  it("sends the details cleared from a pool it starts from as empty, not as the pool's", async () => {
    const { fetcher, user, field, make } = setup(
      () => Response.json({ id: "b-a0000002" }, { status: 201 }),
      START,
    );
    for (const name of ["Tournament", "Round", "Year"]) await user.clear(field(name));
    await make();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/pools/b-a0000002/edit"));
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      name: "OWC 2023 Finals",
      tournament: "",
      round: "",
      year: null,
      startedFrom: "otdb-9",
    });
  });
});
