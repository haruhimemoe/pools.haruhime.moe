"""
@file scripts/similar/build.py
@desc Builds similar_maps from BoBERT's embeddings (run on David's Mac, never in production):
      downloads the pinned revision, finds each map's top 20 neighbors and its top 20 among
      leaderboard maps (ranked, approved, loved), then either saves them
      to a local .npz (--out, no database), prints the space estimate (--dry-run: reads dbStats,
      writes nothing), or imports them (similar_maps_next, then a rename over similar_maps) after
      the space guard. Reads MONGODB_URI from the environment and never prints it.
      From scripts/similar: uv run --env-file ../../.env.local build.py [--dry-run | --out f]
@author David @dvhsh (https://dvh.sh)
@created Mon Sep 28, 2026
@modified Mon Sep 28, 2026
"""

from __future__ import annotations

import argparse
import os
import sys
import time

import numpy as np
import pyarrow.parquet as pq

from neighbors import K, top_neighbors
from source import REV, fetch, load_embeddings, load_leaderboard, load_set_ids
from store import check_space, doc_bytes, docs_of, estimate_bytes, write_docs

DB_NAME = "pools"
"""The app's database (DB_NAME in src/lib/db.ts)."""


Result = tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, float]


def compute(limit: int | None) -> Result:
    """
    @function compute
    @param limit {int | None} only the first this many maps (a quick trial), else all
    @returns {tuple} ids, neighbors, cosines, leaderboard neighbors, their cosines, and the
             seconds the neighbor math took
    """
    ids, vectors = load_embeddings(fetch("embeddings.parquet"))
    if limit:
        ids, vectors = ids[:limit], vectors[:limit]
    beatmaps = fetch("data/beatmaps.parquet")
    set_ids = load_set_ids(beatmaps, ids)
    leaderboard = load_leaderboard(beatmaps, ids)
    print(
        f"{len(ids)} maps ({int(leaderboard.sum())} with a leaderboard), {vectors.shape[1]} "
        f"dimensions, {len(np.unique(set_ids))} sets"
    )
    started = time.monotonic()

    def progress(done: int, total: int) -> None:
        if done % (100 * 512) < 512 or done == total:
            print(f"  {done}/{total} ({time.monotonic() - started:.0f} s)", flush=True)

    print("all maps:")
    out, near, cos = top_neighbors(ids, set_ids, vectors, K, progress=progress)
    print("leaderboard maps only:")
    lb_ids, lb_near, lb_cos = top_neighbors(
        ids, set_ids, vectors, K, progress=progress, among=leaderboard
    )
    assert (lb_ids == out).all()
    return out, near, cos, lb_near, lb_cos, time.monotonic() - started


def embedded_count() -> int:
    """
    @function embedded_count
    @returns {int} how many maps the embeddings file holds (read from its footer)
    """
    return pq.ParquetFile(fetch("embeddings.parquet")).metadata.num_rows


def full_doc() -> dict:
    """
    @function full_doc
    @returns {dict} a document with K neighbors, the size every real one has at most
    """
    ones = np.ones((1, K), dtype=np.uint32)
    scores = np.ones((1, K), np.float32)
    return next(docs_of(np.array([1]), ones, scores, REV, ones, scores))


def database():
    """
    @function database
    @returns {pymongo.database.Database} the pools database MONGODB_URI reaches
    @throws {SystemExit} when MONGODB_URI isn't set
    """
    from pymongo import MongoClient

    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        sys.exit("MONGODB_URI isn't set (uv run --env-file ../../.env.local build.py)")
    return MongoClient(uri, appname="pools-similar-maps")[DB_NAME]


def main() -> None:
    """
    @function main
    @returns {None} runs the build the flags ask for
    """
    parser = argparse.ArgumentParser(description="Build similar_maps from BoBERT's embeddings.")
    parser.add_argument("--dry-run", action="store_true", help="print the estimate, write nothing")
    parser.add_argument("--out", help="save neighbors to this .npz instead of the database")
    parser.add_argument("--limit", type=int, help="only the first N maps (a trial)")
    args = parser.parse_args()

    if args.out:
        ids, neighbors, cosines, lb_neighbors, lb_cosines, seconds = compute(args.limit)
        print(f"neighbors in {seconds:.0f} s")
        estimate = estimate_bytes(len(ids), full_doc())
        np.savez_compressed(
            args.out,
            ids=ids,
            neighbors=neighbors,
            cosines=cosines,
            lb_neighbors=lb_neighbors,
            lb_cosines=lb_cosines,
        )
        print(f"saved {args.out}; a real import would be about {estimate / 1024 / 1024:.1f} MB")
        return
    count = min(embedded_count(), args.limit or sys.maxsize)
    db = database()
    stats = db.command("dbStats")
    sample = full_doc()
    estimate = estimate_bytes(count, sample)
    fits, line = check_space(int(stats["dataSize"]), int(stats["indexSize"]), estimate)
    print(f"{count} maps, at most {doc_bytes(sample)} bytes each (n, s, nl, sl); {line}")
    if args.dry_run:
        print("dry run: nothing written")
        return
    if not fits:
        sys.exit("refusing: the import would pass the space limit")
    ids, neighbors, cosines, lb_neighbors, lb_cosines, seconds = compute(args.limit)
    print(f"neighbors in {seconds:.0f} s")
    started = time.monotonic()
    docs = docs_of(ids, neighbors, cosines, REV, lb_neighbors, lb_cosines)
    written = write_docs(db, docs)
    print(f"wrote {written} documents to similar_maps in {time.monotonic() - started:.0f} s")


if __name__ == "__main__":
    main()
