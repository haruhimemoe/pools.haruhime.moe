/**
 * @file src/app/api/admin/pools/route.ts
 * @desc POST, admins only: add a host or community pool (src/services/add-pool.ts). Everyone
 *       else gets the same 404, so the route never confirms it exists; then requests from other
 *       sites (a sibling *.haruhime.moe host included) are refused, and the body must be JSON.
 *       A form problem answers 400 with a message per field (`error.fields`). A new pool answers
 *       201, maps that joined a stored pool 200 (`alreadyCredited` when that pool had the same
 *       credit, so nothing was added), both naming the pool and its admin page. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import { errorCodeFor, jsonError, noStore, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { z } from "zod";
import { refuseCrossSite } from "@/lib/api";
import { getAdminFromHeaders } from "@/lib/auth";
import { addPoolBodySchema, fieldErrors } from "@/schemas/admin";
import { addPool } from "@/services/add-pool";

/** A save fills the pool's maps from the mirror and waits on one PUT to packs. */
export const maxDuration = 60;

const fieldsError = (fields: Record<string, string>): Response =>
  noStore(
    Response.json(
      {
        error: {
          code: errorCodeFor(400),
          message: Object.values(fields)[0] ?? "That pool can't be added.",
          fields,
        },
      },
      { status: 400 },
    ),
  );

export async function POST(request: Request) {
  if (!(await getAdminFromHeaders(request.headers))) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, z.unknown());
  if (!body.ok) return noStore(body.response);
  const form = addPoolBodySchema.safeParse(body.data);
  if (!form.success) return fieldsError(fieldErrors(form.error));
  const result = await addPool(form.data);
  if (!result.ok) return fieldsError(result.fields);
  const status = result.answer.outcome === "created" ? 201 : 200;
  return noStore(Response.json(result.answer, { status }));
}
