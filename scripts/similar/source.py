"""
@file scripts/similar/source.py
@desc BoBERT's published files at a pinned Hugging Face revision (token03/bobert, MIT, by
      token03): embeddings.parquet (beatmap_id int64, embedding fixed_size_list<float16>[384],
      density) and data/beatmaps.parquet (id, beatmapset_id and osu!'s other fields), downloaded
      once into the gitignored .cache/<rev>/ and checked against their SHA-256. A map missing
      from beatmaps.parquet gets its own negative set id, so only itself is left out. Its
      `status` column (osu!'s integer codes as strings) says which maps have a leaderboard.
@author David @dvhsh (https://dvh.sh)
@created Mon Sep 28, 2026
@modified Mon Sep 28, 2026
"""

from __future__ import annotations

import hashlib
import os
import urllib.request
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq

REPO = "token03/bobert"
"""The Hugging Face repository."""

REV = "v14.1"
"""The pinned BoBERT revision."""

FILES = {
    "embeddings.parquet": "7f92bcd664f86500d5a32c5f2ccc69957ae35db792bb30064ea198deb9ead30e",
    "data/beatmaps.parquet": "a5a3cfbe7916a63629e7411f71a8ec8c26535dcf9a8c56694262298d8680e15d",
}
"""Each file at REV and its SHA-256."""

CACHE = Path(__file__).resolve().parent / ".cache"
"""Downloads live here (gitignored)."""

LEADERBOARD_STATUSES = frozenset({"1", "2", "4"})
"""osu!'s status codes for ranked, approved and loved (compliance's isLeaderboardStatus); -2
graveyard, -1 WIP, 0 pending and 3 qualified have no leaderboard."""

USER_AGENT = "pools.haruhime.moe similar-maps build (+https://pools.haruhime.moe)"


def sha256_of(path: Path) -> str:
    """
    @function sha256_of
    @param path {Path} a file
    @returns {str} its SHA-256, hex
    """
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(name: str, rev: str = REV, cache: Path = CACHE) -> Path:
    """
    @function fetch
    @param name {str} a path in the repository (a key of FILES)
    @param rev {str} the revision
    @param cache {Path} the cache folder
    @returns {Path} the local copy, downloaded when missing
    @throws {RuntimeError} when the file's SHA-256 isn't the pinned one
    """
    path = cache / rev / Path(name).name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"https://huggingface.co/{REPO}/resolve/{rev}/{name}"
        part = path.with_suffix(".part")
        print(f"downloading {url}")
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request) as response, part.open("wb") as out:
            while chunk := response.read(1 << 20):
                out.write(chunk)
        os.replace(part, path)
    expected = FILES.get(name)
    if expected and rev == REV and sha256_of(path) != expected:
        raise RuntimeError(f"{path.name} doesn't match the pinned SHA-256; delete it and rerun")
    return path


def load_embeddings(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """
    @function load_embeddings
    @param path {Path} embeddings.parquet
    @returns {tuple} beatmap ids (n,) int64 and embeddings (n, d) float32
    """
    table = pq.read_table(path, columns=["beatmap_id", "embedding"])
    ids = table.column("beatmap_id").to_numpy()
    column = table.column("embedding").combine_chunks()
    width = column.type.list_size
    flat = column.flatten().to_numpy(zero_copy_only=False)
    return ids.astype(np.int64), flat.reshape(-1, width).astype(np.float32)


def load_set_ids(path: Path, ids: np.ndarray) -> np.ndarray:
    """
    @function load_set_ids
    @param path {Path} beatmaps.parquet
    @param ids {np.ndarray} the embedded beatmap ids
    @returns {np.ndarray} (n,) each one's beatmapset id, or minus its own id when unknown
    """
    table = pq.read_table(path, columns=["id", "beatmapset_id"])
    known = dict(zip(table.column("id").to_pylist(), table.column("beatmapset_id").to_pylist()))
    return np.array([known.get(int(i), -int(i)) for i in ids], dtype=np.int64)


def load_leaderboard(path: Path, ids: np.ndarray) -> np.ndarray:
    """
    @function load_leaderboard
    @param path {Path} beatmaps.parquet
    @param ids {np.ndarray} the embedded beatmap ids
    @returns {np.ndarray} (n,) bool: the map is ranked, approved or loved (unknown maps aren't)
    """
    table = pq.read_table(path, columns=["id", "status"])
    known = dict(zip(table.column("id").to_pylist(), table.column("status").to_pylist()))
    return np.array([known.get(int(i)) in LEADERBOARD_STATUSES for i in ids], dtype=bool)
