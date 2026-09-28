/**
 * @file src/utils/built-answer.ts
 * @desc What the built pool services answer: a value, or a refusal with an HTTP status, a machine
 *       code, a message for people, and maybe the failing op's details or the pool as it is now
 *       (a 409); and BuiltPoolView, the pool as the API sends it. Pure, types and one helper.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import type { Visibility } from "@/constants/built-pools";
import type { SlotCandidates } from "@/schemas/built-candidates";
import type { BucketTargets, SlotNotes } from "@/schemas/built-plan";
import type { BuiltEditor } from "@/schemas/built-pool";
import type { ClientPack } from "@/schemas/built-pool-view";
import type { Access } from "@/utils/built-access";

/** A refused request: its status, code and message, and what else the error body carries. */
export type Refusal = {
  ok: false;
  status: 400 | 403 | 404 | 409 | 502 | 503;
  code: string;
  message: string;
  /** Extra fields for the error body (the failing op, a paste's lines). */
  details?: Record<string, unknown>;
  /** The pool as it is now (a 409). */
  pool?: BuiltPoolView;
};

/** A service's answer: the value, or why not. */
export type Answer<T> = { ok: true; value: T } | Refusal;

/**
 * @function refuse
 * @param status {Refusal["status"]} HTTP status
 * @param code {string} machine code
 * @param message {string} for people
 * @param extra {Pick<Refusal, "details" | "pool">} more to send
 * @returns {Refusal} the refusal
 */
export const refuse = (
  status: Refusal["status"],
  code: string,
  message: string,
  extra: Pick<Refusal, "details" | "pool"> = {},
): Refusal => ({ ok: false, status, code, message, ...extra });

/** The 404 message for a pool the caller can't see (or that isn't there). */
export const NOT_FOUND = "That pool isn't here.";

/** What the API sends: the pool, its owner's osu! name, every bucket, and the caller's rights. */
export type BuiltPoolView = {
  id: string;
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  notes: string;
  visibility: Visibility;
  hidden: boolean;
  owner: { osuId: number; username: string } | null;
  /** signedIn (they have a user id) goes to the owner only, who can hand the pool to them. */
  editors: (Omit<BuiltEditor, "userId"> & { signedIn?: boolean })[];
  buckets: BucketEntry[];
  slots: PoolSlot[];
  /** Each bucket's target ({} when there are none). */
  targets: BucketTargets;
  /** Each slot's note by beatmap id ({} when there are none). */
  slotNotes: SlotNotes;
  /** Each slot's candidates: sent only to the owner and editors, never to a page or visitor. */
  candidates?: SlotCandidates;
  /** The caller's osu! id, sent with the candidates. */
  me?: number;
  version: number;
  pack: ClientPack;
  startedFrom: string | null;
  createdAt: Date;
  updatedAt: Date;
  access: Pick<Access, "isOwner" | "isEditor" | "canEdit" | "canManage" | "canDelete">;
};
