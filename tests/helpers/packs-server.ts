/**
 * @file tests/helpers/packs-server.ts
 * @desc A stand-in for packs' service endpoint: PUT /api/service/pools/:id recording each call
 *       (id, body, Authorization, User-Agent) and answering as the test says, DELETE
 *       /api/service/pools/:id recording the ref and headers, and POST /api/service/pools/stats
 *       answering from a list.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse, http } from "msw";
import type { PacksService } from "@/env";
import type { PackInput } from "@/utils/pack-input";

export const PACKS_URL_FOR_TESTS = "https://packs.test";

export const TEST_SERVICE: PacksService = { url: PACKS_URL_FOR_TESTS, token: "t".repeat(40) };

export type PutCall = {
  id: string;
  body: PackInput;
  authorization: string | null;
  userAgent: string | null;
};

/**
 * @function slugFor
 * @param id {string} a pool id
 * @returns {string} a stable 10-character pack slug for it
 */
export const slugFor = (id: string): string =>
  `s${id.replace(/[^a-z0-9]/g, "")}`.slice(0, 10).padEnd(10, "x");

/**
 * @function createdAnswer
 * @param id {string} a pool id
 * @returns {Response} packs' 201 for a new, listed pack
 */
export const createdAnswer = (id: string): Response =>
  HttpResponse.json({ slug: slugFor(id), state: "created", listed: true }, { status: 201 });

/**
 * @function packsPutHandler
 * @param answer {(id: string, body: PackInput) => Response | Promise<Response>} what packs says
 * @param calls {PutCall[]} filled with every request
 * @returns the msw handler
 */
export const packsPutHandler = (
  answer: (id: string, body: PackInput) => Response | Promise<Response>,
  calls: PutCall[] = [],
) =>
  http.put(`${PACKS_URL_FOR_TESTS}/api/service/pools/:id`, async ({ params, request }) => {
    const body = (await request.json()) as PackInput;
    const id = String(params.id);
    calls.push({
      id,
      body,
      authorization: request.headers.get("authorization"),
      userAgent: request.headers.get("user-agent"),
    });
    return answer(id, body);
  });

/**
 * @function packsStatsHandler
 * @param answers {(() => Response)[]} one answer per call, in order (the last repeats)
 * @returns the msw handler
 */
export const packsStatsHandler = (answers: (() => Response)[]) => {
  let call = 0;
  return http.post(`${PACKS_URL_FOR_TESTS}/api/service/pools/stats`, () => {
    const answer = answers[Math.min(call, answers.length - 1)];
    call += 1;
    return answer ? answer() : HttpResponse.json({ updated: 0, remaining: 0 });
  });
};

export type DeleteCall = { id: string; authorization: string | null; userAgent: string | null };

/**
 * @function packsDeleteHandler
 * @param answer {(id: string) => Response} what packs says (204 removed by default)
 * @param calls {DeleteCall[]} filled with every request
 * @returns the msw handler
 */
export const packsDeleteHandler = (
  answer: (id: string) => Response = () => new HttpResponse(null, { status: 204 }),
  calls: DeleteCall[] = [],
) =>
  http.delete(`${PACKS_URL_FOR_TESTS}/api/service/pools/:id`, ({ params, request }) => {
    const id = String(params.id);
    calls.push({
      id,
      authorization: request.headers.get("authorization"),
      userAgent: request.headers.get("user-agent"),
    });
    return answer(id);
  });
