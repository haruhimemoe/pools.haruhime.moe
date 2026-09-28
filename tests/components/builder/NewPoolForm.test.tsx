/**
 * @file tests/components/builder/NewPoolForm.test.tsx
 * @desc "Make a pool": a missing name or a year that isn't one is said under its field (focus
 *       goes there) with nothing sent; a good form POSTs the name and the details given, then
 *       goes to the new pool's editor; a refusal is said in the page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewPoolForm } from "@/components/builder/NewPoolForm";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => vi.clearAllMocks());

const setup = (answer: () => Response) => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => answer());
  const user = userEvent.setup();
  render(<NewPoolForm fetcher={fetcher as unknown as typeof fetch} />);
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
      year: 2026,
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
});
