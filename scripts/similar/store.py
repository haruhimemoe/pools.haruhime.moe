"""
@file scripts/similar/store.py
@desc The similar_maps rows and their import: one document per map, { _id: beatmap id, n: BinData
      (uint32 little-endian neighbor ids, best first), s: BinData (uint8 scores, cosine 0..1 as
      0..255), nl, sl: the same for the top neighbors among leaderboard maps only, rev }, the
      space guard (dbStats data + index size after the import must stay at
      or under the limit, 400 MB), and the write: into similar_maps_next, then a rename over
      similar_maps, so the app never reads a half-written table. Never prints the connection
      string.
@author David @dvhsh (https://dvh.sh)
@created Mon Sep 28, 2026
@modified Mon Sep 28, 2026
"""

from __future__ import annotations

from collections.abc import Iterator

import numpy as np

from neighbors import scale_scores

COLLECTION = "similar_maps"
"""The collection the app reads."""

NEXT_COLLECTION = "similar_maps_next"
"""Where an import writes before the rename."""

LIMIT_BYTES = 400 * 1024 * 1024
"""The most data + index size the database may reach after an import."""

INDEX_BYTES_PER_DOC = 24
"""A generous estimate of the _id index's size per document."""

INSERT_BATCH = 5000
"""Documents per insert_many."""

MB = 1024 * 1024


def _packed(neighbors: np.ndarray, cosines: np.ndarray) -> tuple[bytes, bytes]:
    """Ids as uint32 LE and scores as uint8, padding (id 0) dropped."""
    keep = neighbors != 0
    return neighbors[keep].astype("<u4").tobytes(), scale_scores(cosines[keep]).tobytes()


def doc_of(
    beatmap_id: int,
    neighbors: np.ndarray,
    cosines: np.ndarray,
    rev: str,
    lb_neighbors: np.ndarray | None = None,
    lb_cosines: np.ndarray | None = None,
) -> dict:
    """
    @function doc_of
    @param beatmap_id {int} the map
    @param neighbors {np.ndarray} its neighbor ids, best first (0 is padding, dropped)
    @param cosines {np.ndarray} their cosines
    @param rev {str} the BoBERT revision
    @param lb_neighbors {np.ndarray | None} its neighbors among leaderboard maps, best first
    @param lb_cosines {np.ndarray | None} their cosines
    @returns {dict} the similar_maps document (bytes become BinData subtype 0); nl and sl only
             when leaderboard neighbors are given
    """
    n, s = _packed(neighbors, cosines)
    doc = {"_id": int(beatmap_id), "n": n, "s": s}
    if lb_neighbors is not None and lb_cosines is not None:
        doc["nl"], doc["sl"] = _packed(lb_neighbors, lb_cosines)
    doc["rev"] = rev
    return doc


def docs_of(
    ids: np.ndarray,
    neighbors: np.ndarray,
    cosines: np.ndarray,
    rev: str,
    lb_neighbors: np.ndarray | None = None,
    lb_cosines: np.ndarray | None = None,
) -> Iterator[dict]:
    """
    @function docs_of
    @param ids {np.ndarray} (n,) beatmap ids
    @param neighbors {np.ndarray} (n, k) neighbor ids
    @param cosines {np.ndarray} (n, k) cosines
    @param rev {str} the BoBERT revision
    @param lb_neighbors {np.ndarray | None} (n, k) neighbor ids among leaderboard maps
    @param lb_cosines {np.ndarray | None} (n, k) their cosines
    @returns {Iterator[dict]} one document per map with at least one neighbor
    """
    for row, beatmap_id in enumerate(ids):
        lb = (None, None) if lb_neighbors is None else (lb_neighbors[row], lb_cosines[row])
        doc = doc_of(int(beatmap_id), neighbors[row], cosines[row], rev, *lb)
        if doc["n"] or doc.get("nl"):
            yield doc


def doc_bytes(doc: dict) -> int:
    """
    @function doc_bytes
    @param doc {dict} a similar_maps document
    @returns {int} its BSON size
    """
    import bson

    return len(bson.encode(doc))


def estimate_bytes(count: int, sample: dict | None) -> int:
    """
    @function estimate_bytes
    @param count {int} documents to write
    @param sample {dict | None} one full document (None when there are none)
    @returns {int} their data size plus the _id index estimate
    """
    if count == 0 or sample is None:
        return 0
    return count * (doc_bytes(sample) + INDEX_BYTES_PER_DOC)


def check_space(
    data_bytes: int, index_bytes: int, adding: int, limit: int = LIMIT_BYTES
) -> tuple[bool, str]:
    """
    @function check_space
    @param data_bytes {int} dbStats dataSize now
    @param index_bytes {int} dbStats indexSize now
    @param adding {int} the import's estimate
    @param limit {int} the most data + index size allowed after it
    @returns {tuple[bool, str]} whether it fits, and a line saying the numbers in MB
    """
    now = data_bytes + index_bytes
    after = now + adding
    line = (
        f"database now {now / MB:.1f} MB (data {data_bytes / MB:.1f}, indexes "
        f"{index_bytes / MB:.1f}); import about {adding / MB:.1f} MB; after {after / MB:.1f} MB "
        f"of {limit / MB:.0f} MB allowed"
    )
    return after <= limit, line


def write_docs(db, docs: Iterator[dict], progress=None) -> int:
    """
    @function write_docs
    @param db {pymongo.database.Database} the pools database
    @param docs {Iterator[dict]} the documents
    @param progress {callable | None} called with the count written after each batch
    @returns {int} documents written; similar_maps now holds exactly them
    """
    db.drop_collection(NEXT_COLLECTION)
    target = db[NEXT_COLLECTION]
    written = 0
    batch: list[dict] = []
    for doc in docs:
        batch.append(doc)
        if len(batch) >= INSERT_BATCH:
            target.insert_many(batch, ordered=False)
            written += len(batch)
            batch = []
            if progress:
                progress(written)
    if batch:
        target.insert_many(batch, ordered=False)
        written += len(batch)
    if written == 0:
        db.drop_collection(NEXT_COLLECTION)
        return 0
    target.rename(COLLECTION, dropTarget=True)
    return written
