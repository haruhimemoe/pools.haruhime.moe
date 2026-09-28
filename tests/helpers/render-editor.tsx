/**
 * @file tests/helpers/render-editor.tsx
 * @desc Renders the pool editor over the fake pool API (tests/helpers/pool-editor.ts) with every
 *       slot's map details known, and gives the test the API, a user-event session, each
 *       bucket's map order, and a wait for "All changes saved.". Each test file mocks
 *       next/navigation itself.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoolEditor } from "@/components/builder/PoolEditor";
import type { ClientPool } from "@/schemas/built-pool-view";
import type { SlotValueMap } from "@/utils/slot-values";
import { clientPool, fakePoolApi, mapsFor, RULES } from "./pool-editor";

type RenderOptions = {
  me?: number;
  pollMs?: number;
  values?: SlotValueMap;
  valuesComplete?: boolean;
};

/**
 * @function renderEditor
 * @param pool {ClientPool} the pool to edit (default: three NM maps, owned by osu! id 10)
 * @param options {RenderOptions} the signed-in osu! id, the poll interval, the values the page
 *        read and whether that read was complete
 * @returns the fake API, user-event, bucket order, a wait for saving to end, and render's result
 */
export const renderEditor = (
  pool: ClientPool = clientPool(),
  { me = pool.owner?.osuId ?? 10, pollMs, values = {}, valuesComplete = true }: RenderOptions = {},
) => {
  const api = fakePoolApi(pool);
  const user = userEvent.setup();
  const view = render(
    <PoolEditor
      initial={pool}
      maps={mapsFor(pool.slots.map((slot) => slot.beatmapId))}
      values={values}
      valuesComplete={valuesComplete}
      me={me}
      rules={RULES}
      fetcher={api.fetcher}
      {...(pollMs ? { pollMs } : {})}
    />,
  );
  const order = (bucket = "NM") =>
    [...view.container.querySelectorAll(`[data-bucket="${bucket}"] li[data-map]`)].map((li) =>
      Number(li.getAttribute("data-map")),
    );
  const saved = () => screen.findByText("All changes saved.");
  return { api, user, order, saved, ...view };
};
