"""
@file scripts/similar/tests/test_store.py
@desc The similar_maps documents (little-endian uint32 ids, uint8 scores, padding dropped), the
      size estimate and the space guard, and the write through a stand-in database (next, then
      the rename). No network, no real database.
@author David @dvhsh (https://dvh.sh)
@created Mon Sep 28, 2026
@modified Mon Sep 28, 2026
"""

import struct

import numpy as np

import store

MB = 1024 * 1024


def test_doc_packs_ids_and_scores_and_drops_padding():
    doc = store.doc_of(
        42,
        np.array([7, 70000, 0], dtype=np.uint32),
        np.array([1.0, 0.5, -1.0], dtype=np.float32),
        "v14.1",
    )
    assert doc["_id"] == 42 and doc["rev"] == "v14.1"
    assert struct.unpack("<2I", doc["n"]) == (7, 70000)
    assert list(doc["s"]) == [255, 128]


def test_docs_skip_maps_with_no_neighbors():
    ids = np.array([1, 2])
    near = np.array([[3], [0]], dtype=np.uint32)
    cos = np.array([[0.9], [-1.0]], dtype=np.float32)
    assert [doc["_id"] for doc in store.docs_of(ids, near, cos, "v")] == [1]


def test_doc_packs_leaderboard_neighbors_too():
    doc = store.doc_of(
        42,
        np.array([7, 8], dtype=np.uint32),
        np.array([0.9, 0.8], dtype=np.float32),
        "v",
        np.array([9, 0], dtype=np.uint32),
        np.array([0.5, -1.0], dtype=np.float32),
    )
    assert struct.unpack("<I", doc["nl"]) == (9,)
    assert list(doc["sl"]) == [128]
    ids = np.array([1])
    near = np.array([[0]], dtype=np.uint32)
    cos = np.array([[-1.0]], dtype=np.float32)
    lb = np.array([[5]], dtype=np.uint32)
    kept = list(store.docs_of(ids, near, cos, "v", lb, np.array([[0.7]], np.float32)))
    assert [d["_id"] for d in kept] == [1] and kept[0]["n"] == b""


def test_estimate_counts_bson_and_the_index():
    doc = store.doc_of(1, np.ones(20, np.uint32), np.ones(20, np.float32), "v14.1")
    size = store.doc_bytes(doc)
    assert 130 < size < 160
    assert store.estimate_bytes(1000, doc) == 1000 * (size + store.INDEX_BYTES_PER_DOC)
    assert store.estimate_bytes(0, None) == 0
    ones, scores = np.ones(20, np.uint32), np.ones(20, np.float32)
    full = store.doc_of(1, ones, scores, "v14.1", ones, scores)
    assert 250 < store.doc_bytes(full) < 280


def test_space_guard_refuses_past_the_limit():
    fits, line = store.check_space(300 * MB, 20 * MB, 70 * MB)
    assert fits and "after 390.0 MB of 400 MB" in line
    fits, line = store.check_space(300 * MB, 20 * MB, 81 * MB)
    assert not fits and "database now 320.0 MB" in line


class FakeCollection:
    def __init__(self, db, name):
        self.db, self.name, self.docs = db, name, []

    def insert_many(self, docs, ordered):
        self.docs.extend(docs)

    def rename(self, name, dropTarget):
        assert dropTarget
        self.db.collections[name] = self.db.collections.pop(self.name)
        self.name = name


class FakeDb:
    def __init__(self):
        self.collections = {"similar_maps": FakeCollection(self, "similar_maps")}
        self.dropped = []

    def drop_collection(self, name):
        self.dropped.append(name)
        self.collections.pop(name, None)

    def __getitem__(self, name):
        return self.collections.setdefault(name, FakeCollection(self, name))


def test_write_goes_to_next_then_renames(monkeypatch):
    monkeypatch.setattr(store, "INSERT_BATCH", 2)
    db = FakeDb()
    docs = ({"_id": i} for i in range(5))
    assert store.write_docs(db, docs) == 5
    assert db.dropped == ["similar_maps_next"]
    assert list(db.collections) == ["similar_maps"]
    assert [doc["_id"] for doc in db.collections["similar_maps"].docs] == [0, 1, 2, 3, 4]


def test_write_of_nothing_keeps_the_table():
    db = FakeDb()
    kept = db.collections["similar_maps"]
    assert store.write_docs(db, iter([])) == 0
    assert db.collections["similar_maps"] is kept
