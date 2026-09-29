/**
 * @file src/utils/similar-binary.ts
 * @desc Reads a similar_maps row: `n` holds the neighbors' beatmap ids as little-endian uint32s,
 *       best first, and `s` one uint8 score each (cosine similarity 0..1 as 0..255). Rows with
 *       a ragged or empty `n`, a zero id, or fewer scores than ids read as far as they're whole.
 *       Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** One neighbor: its beatmap id and score 0..255. */
export type Neighbor = { id: number; score: number };

/**
 * @function decodeNeighbors
 * @param n {Uint8Array} the ids' bytes
 * @param s {Uint8Array} the scores' bytes
 * @returns {Neighbor[]} each whole id that has a score, in order, zero ids and repeats left out
 */
export const decodeNeighbors = (n: Uint8Array, s: Uint8Array): Neighbor[] => {
  const view = new DataView(n.buffer, n.byteOffset, n.byteLength);
  const count = Math.min(Math.floor(n.byteLength / 4), s.byteLength);
  const seen = new Set<number>();
  const out: Neighbor[] = [];
  for (let i = 0; i < count; i++) {
    const id = view.getUint32(i * 4, true);
    if (id === 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, score: s[i] ?? 0 });
  }
  return out;
};

/**
 * @function encodeNeighbors
 * @param neighbors {readonly Neighbor[]} ids and scores 0..255
 * @returns {{ n: Uint8Array; s: Uint8Array }} the bytes scripts/similar writes (tests, fixtures)
 */
export const encodeNeighbors = (
  neighbors: readonly Neighbor[],
): { n: Uint8Array; s: Uint8Array } => {
  const n = new Uint8Array(neighbors.length * 4);
  const view = new DataView(n.buffer);
  neighbors.forEach((neighbor, i) => {
    view.setUint32(i * 4, neighbor.id, true);
  });
  return { n, s: Uint8Array.from(neighbors, (neighbor) => neighbor.score) };
};

/**
 * @function scorePercent
 * @param score {number} 0..255
 * @returns {number} the same as a whole percent, 0..100
 */
export const scorePercent = (score: number): number =>
  Math.round((Math.min(Math.max(score, 0), 255) / 255) * 100);
