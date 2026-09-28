/**
 * @file src/app/api/pools/[id]/editors/[osuId]/route.ts
 * @desc DELETE: the owner removes a co-editor, or an editor removes themselves. Signed in, from
 *       this site, 30 editor changes an hour per user. 204; 404 when they don't edit the pool
 *       (or the osu! id isn't a number). A shared pool's pack syncs after the answer. Never
 *       cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { jsonError, noStore } from "@/lib/api";
import { schedulePackSync } from "@/lib/pack-sync-after";
import { guardWrite, limitUser, noContent, refusalResponse } from "@/lib/pool-routes";
import { removeBuiltPoolEditor } from "@/services/built-pool-editors";

type Context = { params: Promise<{ id: string; osuId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  const { id, osuId } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  if (!/^[1-9]\d{0,9}$/.test(osuId)) return noStore(jsonError(404, "They don't edit this pool."));
  const limited = await limitUser(RATE_LIMITS.poolEditors, caller.value);
  if (limited) return limited;
  const answer = await removeBuiltPoolEditor(id, caller.value, Number(osuId));
  if (!answer.ok) return refusalResponse(answer);
  schedulePackSync(id);
  return noContent();
}
