"""
@file scripts/similar/neighbors.py
@desc The neighbor math for similar maps: L2-normalize BoBERT's embeddings, then for every map the
      top K others by cosine similarity, never itself or another difficulty of its beatmapset.
      Rows are sorted by set first so a map's own set is one contiguous run of columns, masked in
      one slice per row. Batched matrix products on the CPU (numpy's BLAS), float32, a few batches
      at a time on threads; each row's top K comes from the columns over a sampled floor.
      Neighbors at COPY_COSINE or over are copies of the map in other sets (reuploads, HP or AR
      edits) and are left out, so popular maps don't list their own copies. `among` limits the
      neighbors to a subset (the leaderboard maps) while every map still gets a row.
@author David @dvhsh (https://dvh.sh)
@created Mon Sep 28, 2026
@modified Mon Sep 28, 2026
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import numpy as np

K = 20
"""Neighbors kept per map."""

BATCH = 256
"""Rows per matrix product (256 x 500k float32 is about 0.5 GB)."""

WORKERS = 4
"""Batches in flight at once (numpy lets go of the GIL for the heavy parts)."""

SAMPLE = 16384
"""Columns sampled per row to find its floor."""

COPY_COSINE = 0.999
"""At or over this, a neighbor is a copy of the map (a reupload or an edit in another set)."""

SPARE = 20
"""Extra candidates per row, so dropping copies still leaves K."""


def normalize(vectors: np.ndarray) -> np.ndarray:
    """
    @function normalize
    @param vectors {np.ndarray} (n, d) embeddings, any float type
    @returns {np.ndarray} (n, d) float32 rows of length 1 (an all-zero row stays zero)
    """
    out = np.asarray(vectors, dtype=np.float32)
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return out / norms


def scale_scores(cosines: np.ndarray) -> np.ndarray:
    """
    @function scale_scores
    @param cosines {np.ndarray} cosine similarities
    @returns {np.ndarray} uint8: cosine 0..1 as 0..255 (negative ones as 0)
    """
    return np.rint(np.clip(cosines, 0.0, 1.0) * 255).astype(np.uint8)


def set_runs(set_ids: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    @function set_runs
    @param set_ids {np.ndarray} (n,) each map's beatmapset id
    @returns {tuple} the order that sorts maps by set (stable), and each sorted row's run start
             and end (its set's columns in that order)
    """
    order = np.argsort(set_ids, kind="stable")
    sorted_sets = set_ids[order]
    starts = np.searchsorted(sorted_sets, sorted_sets, side="left")
    ends = np.searchsorted(sorted_sets, sorted_sets, side="right")
    return order, starts, ends


def _row_top(sims: np.ndarray, m: int) -> tuple[np.ndarray, np.ndarray]:
    """
    The m largest of each row, best first. A strided sample of the columns gives each row a
    floor (its m-th largest sampled value is never above its true m-th largest), so only the
    columns at or over it are sorted.
    """
    rows, width = sims.shape
    step = max(1, width // SAMPLE)
    floor = np.partition(sims[:, ::step], -m, axis=1)[:, -m]
    hit_rows, hit_cols = np.nonzero(sims >= floor[:, None])
    values = sims[hit_rows, hit_cols]
    order = np.lexsort((-values, hit_rows))
    hit_rows, hit_cols, values = hit_rows[order], hit_cols[order], values[order]
    firsts = np.searchsorted(hit_rows, np.arange(rows))
    take = (firsts[:, None] + np.arange(m)[None, :]).ravel()
    return hit_cols[take].reshape(rows, m), values[take].reshape(rows, m)


def top_neighbors(
    ids: np.ndarray,
    set_ids: np.ndarray,
    vectors: np.ndarray,
    k: int = K,
    batch: int = BATCH,
    progress=None,
    among: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    @function top_neighbors
    @param ids {np.ndarray} (n,) beatmap ids
    @param set_ids {np.ndarray} (n,) their beatmapset ids
    @param vectors {np.ndarray} (n, d) their embeddings (normalized here)
    @param k {int} neighbors per map
    @param batch {int} rows per matrix product
    @param progress {callable | None} called with (rows done, rows) as batches finish
    @param among {np.ndarray | None} (n,) bool: only these maps may be neighbors (every map
           still gets a row); None lets every map be one
    @returns {tuple} ids (n,) sorted by beatmap id; neighbors (n, m) uint32 beatmap ids, best
             first; cosines (n, m) float32, where m is k or fewer when fewer maps can be neighbors.
             A row with fewer than m candidates (copies left out) is padded with id 0 and
             cosine -1.
    """
    order, starts, ends = set_runs(np.asarray(set_ids))
    sorted_ids = np.asarray(ids)[order]
    x = normalize(np.asarray(vectors)[order])
    n = len(sorted_ids)
    # The neighbor columns: every map, or only those in `among` (a subset of the set-sorted
    # rows is still set-sorted, so each row's own set is still one run of columns).
    if among is None:
        columns = np.arange(n)
        xc = x
    else:
        columns = np.flatnonzero(np.asarray(among, dtype=bool)[order])
        xc = x[columns]
        starts = np.searchsorted(columns, starts)
        ends = np.searchsorted(columns, ends)
    column_ids = sorted_ids[columns]
    width = len(columns)
    m = max(0, min(k, n - 1, width))
    neighbors = np.zeros((n, m), dtype=np.uint32)
    cosines = np.full((n, m), -1.0, dtype=np.float32)
    if m == 0:
        return sorted_ids, neighbors, cosines
    wide = min(m + SPARE, width)

    def run(lo: int) -> int:
        hi = min(lo + batch, n)
        sims = x[lo:hi] @ xc.T
        for row in range(hi - lo):
            sims[row, starts[lo + row] : ends[lo + row]] = -np.inf
        cols, picked = _row_top(sims, wide)
        valid = np.isfinite(picked) & (picked < COPY_COSINE)
        # Stable: valid ones first, each keeping its place, then cut to m.
        keep = np.argsort(~valid, axis=1, kind="stable")[:, :m]
        valid = np.take_along_axis(valid, keep, axis=1)
        chosen = column_ids[np.take_along_axis(cols, keep, axis=1)]
        neighbors[lo:hi] = np.where(valid, chosen, 0)
        cosines[lo:hi] = np.where(valid, np.take_along_axis(picked, keep, axis=1), -1.0)
        return hi - lo

    done = 0
    with ThreadPoolExecutor(WORKERS) as pool:
        for rows in pool.map(run, range(0, n, batch)):
            done += rows
            if progress:
                progress(done, n)
    back = np.argsort(sorted_ids, kind="stable")
    return sorted_ids[back], neighbors[back], cosines[back]
