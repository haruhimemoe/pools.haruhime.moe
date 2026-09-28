/**
 * @file tests/components/hooks/useSlotValues.test.tsx
 * @desc useSlotValues asks for keys it has no values for once nothing is left to save: a failed
 *       answer leaves them unasked and tries again with backoff, a map added while a request is
 *       out is asked for after it, a key an ok answer lacked isn't asked for again, and a 404
 *       stops the asking.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSlotValues } from "@/hooks/useSlotValues";

const value = (stars: number) => ({
  stars,
  ar: 9,
  od: 8,
  cs: 4,
  bpm: 180,
  length: 120,
  mods: "DT",
  source: "mirror" as const,
});
const dt = (beatmapId: number, index: number): PoolSlot => ({ mod: "DT", index, beatmapId });
const BUCKETS = [{ code: "DT" }] as BucketEntry[];
const pool = (slots: PoolSlot[]) => ({ id: "b-a0000001", buckets: BUCKETS, slots });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fetcher whose answers the test hands out one by one. */
const scripted = () => {
  const calls: string[] = [];
  const waiting: ((response: Response) => void)[] = [];
  const fetcher = ((path: string) => {
    calls.push(path);
    return new Promise<Response>((resolve) => waiting.push(resolve));
  }) as typeof fetch;
  const answer = (response: Response) => waiting.shift()?.(response);
  return { calls, fetcher, answer };
};

describe("useSlotValues", () => {
  it("asks again after a failed answer, with backoff, and keeps what comes back", async () => {
    const api = scripted();
    const { result } = renderHook(() =>
      useSlotValues(pool([dt(10, 1)]), {}, true, api.fetcher, 10),
    );
    await waitFor(() => expect(api.calls).toHaveLength(1));
    api.answer(json({ error: { message: "Slow down." } }, 429));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    api.answer(json({ values: { "10:DT": value(7.2) }, complete: true }));
    await waitFor(() => expect(result.current["10:DT"]?.stars).toBe(7.2));
  });

  it("asks for a map added while a request was out, once that request ends", async () => {
    const api = scripted();
    const { result, rerender } = renderHook(
      ({ slots }) => useSlotValues(pool(slots), {}, true, api.fetcher, 10),
      { initialProps: { slots: [dt(10, 1)] } },
    );
    await waitFor(() => expect(api.calls).toHaveLength(1));
    rerender({ slots: [dt(10, 1), dt(20, 2)] });
    api.answer(json({ values: { "10:DT": value(7.2) }, complete: true }));
    await waitFor(() => expect(api.calls).toHaveLength(2));
    api.answer(json({ values: { "10:DT": value(7.2), "20:DT": value(6.1) }, complete: true }));
    await waitFor(() => expect(result.current["20:DT"]?.stars).toBe(6.1));
  });

  it("doesn't ask again for a key an ok answer lacked", async () => {
    const api = scripted();
    renderHook(() => useSlotValues(pool([dt(10, 1)]), {}, true, api.fetcher, 10));
    await waitFor(() => expect(api.calls).toHaveLength(1));
    api.answer(json({ values: {}, complete: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.calls).toHaveLength(1);
  });

  it("stops asking once the pool is gone for this user", async () => {
    const api = scripted();
    renderHook(() => useSlotValues(pool([dt(10, 1)]), {}, true, api.fetcher, 5));
    await waitFor(() => expect(api.calls).toHaveLength(1));
    api.answer(json({ error: { message: "Not found." } }, 404));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.calls).toHaveLength(1);
  });

  it("waits while there's something left to save", async () => {
    const api = scripted();
    const { rerender } = renderHook(
      ({ settled }) => useSlotValues(pool([dt(10, 1)]), {}, settled, api.fetcher, 10),
      { initialProps: { settled: false } },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.calls).toHaveLength(0);
    rerender({ settled: true });
    await waitFor(() => expect(api.calls).toHaveLength(1));
  });
});
