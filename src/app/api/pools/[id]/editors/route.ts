/**
 * @file src/app/api/pools/[id]/editors/route.ts
 * @desc POST `{ username }`: the owner adds a co-editor by osu! username, looked up on osu!
 *       (pools' own app, inside the osu! budget), so someone who never signed in can be added
 *       and gets access once they do. Signed in, from this site, JSON, 30 editor changes an hour
 *       per user. 200 with the pool; 400 for a name osu! doesn't know, the owner, a repeat or an
 *       11th editor; 503 when osu! can't be asked. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import {
  guardWrite,
  limitUser,
  poolResponse,
  readPoolBody,
  refusalResponse,
} from "@/lib/pool-routes";
import { editorBodySchema } from "@/schemas/built-pool-ops";
import { addBuiltPoolEditor } from "@/services/built-pool-editors";

type Context = { params: Promise<{ id: string }> };

/** An osu! token request and one user lookup, 10 s each at most. */
export const maxDuration = 30;

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const body = await readPoolBody(request, editorBodySchema);
  if (!body.ok) return body.response;
  const limited = await limitUser(RATE_LIMITS.poolEditors, caller.value);
  if (limited) return limited;
  const answer = await addBuiltPoolEditor(id, caller.value, body.value.username);
  if (!answer.ok) return refusalResponse(answer);
  return poolResponse({ pool: answer.value });
}
