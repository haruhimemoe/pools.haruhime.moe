"""
@file scripts/similar/tests/test_neighbors.py
@desc The neighbor math on a tiny fixture: normalizing, the same-set and self exclusion, order by
      cosine, padding when too few maps are in other sets, the sampled floor against a brute
      force, and score scaling. No network, no download.
@author David @dvhsh (https://dvh.sh)
@created Mon Sep 28, 2026
@modified Mon Sep 28, 2026
"""

import numpy as np

import neighbors as nb

# Six maps in three sets; the vectors are chosen so the answers are plain to see.
IDS = np.array([60, 10, 20, 30, 40, 50])
SETS = np.array([3, 1, 1, 2, 2, 3])
VECTORS = np.array(
    [
        [0.0, 0.0, 5.0],  # 60, set 3
        [1.0, 0.0, 0.0],  # 10, set 1
        [2.0, 0.1, 0.0],  # 20, set 1: same direction as 10, but its own set
        [0.9, 0.1, 0.0],  # 30, set 2: close to 10
        [0.0, 1.0, 0.0],  # 40, set 2
        [0.6, 0.0, 0.8],  # 50, set 3
    ]
)


def test_normalize_gives_unit_rows_and_keeps_zero_rows():
    out = nb.normalize(np.array([[3.0, 4.0], [0.0, 0.0]]))
    assert out.dtype == np.float32
    assert np.allclose(out, [[0.6, 0.8], [0.0, 0.0]])


def test_scale_scores_maps_cosine_to_bytes():
    assert nb.scale_scores(np.array([1.0, 0.5, 0.0, -0.3, 1.2])).tolist() == [255, 128, 0, 0, 255]


def test_never_self_or_the_same_set_and_best_first():
    ids, near, cos = nb.top_neighbors(IDS, SETS, VECTORS, k=3, batch=2)
    assert ids.tolist() == [10, 20, 30, 40, 50, 60]
    by_id = dict(zip(ids.tolist(), near.tolist()))
    assert by_id[10][0] == 30
    for beatmap_id, found in by_id.items():
        own = set(IDS[SETS == SETS[IDS == beatmap_id][0]].tolist())
        assert own.isdisjoint(found)
    assert (np.diff(cos, axis=1) <= 1e-6).all()
    assert cos[0][0] > 0.99


def test_pads_when_too_few_maps_are_in_other_sets():
    ids, near, cos = nb.top_neighbors(np.array([1, 2, 3]), np.array([7, 7, 8]), VECTORS[:3], k=5)
    assert near.shape == (3, 2)
    assert near[0].tolist() == [3, 0]
    assert cos[0][1] == -1.0
    assert set(near[2].tolist()) == {1, 2}


def test_one_map_has_no_neighbors():
    ids, near, _ = nb.top_neighbors(np.array([5]), np.array([1]), VECTORS[:1])
    assert ids.tolist() == [5]
    assert near.shape == (1, 0)


def test_sampled_floor_matches_brute_force(monkeypatch):
    monkeypatch.setattr(nb, "SAMPLE", 64)
    rng = np.random.default_rng(7)
    n = 900
    vectors = rng.standard_normal((n, 16))
    ids = np.arange(1, n + 1) * 7
    sets = rng.integers(0, 300, n)
    got_ids, near, cos = nb.top_neighbors(ids, sets, vectors, k=10, batch=128)
    unit = nb.normalize(vectors)
    sims = unit @ unit.T
    sims[sets[:, None] == sets[None, :]] = -np.inf
    top = np.argsort(-sims, axis=1, kind="stable")[:, :10]
    assert got_ids.tolist() == ids.tolist()
    assert np.allclose(cos, np.take_along_axis(sims, top, axis=1), atol=1e-5)
    assert (near == ids[top]).mean() > 0.99


def test_copies_are_left_out():
    vectors = np.array([[1.0, 0.0], [1.0, 0.0], [0.9, 0.3], [0.0, 1.0]])
    ids, near, cos = nb.top_neighbors(np.array([1, 2, 3, 4]), np.array([1, 2, 3, 4]), vectors, k=2)
    assert near[0].tolist() == [3, 4]
    assert near[1].tolist() == [3, 4]
    assert (cos < nb.COPY_COSINE).all()
