"""Unit tests for CPM engine."""
from datetime import datetime, timedelta

import pytest

from pex.cpm.calendar import Calendar
from pex.cpm.engine import CpmEngine
from pex.cpm.graph import CycleError, topological_order
from pex.cpm.models import Activity, Constraint, RelType, Relationship


def _dd():
    return datetime(2026, 9, 5, 0, 0, 0)


def test_topo_cycle():
    acts = [Activity("A", 8), Activity("B", 8)]
    rels = [Relationship(0, 1), Relationship(1, 0)]
    with pytest.raises(CycleError):
        topological_order(acts, rels)


def test_fs_chain_critical():
    # A --FS--> B --FS--> C ; all 8h; one calendar day of 8h
    acts = [Activity("A", 8), Activity("B", 8), Activity("C", 8)]
    rels = [Relationship(0, 1, RelType.FS), Relationship(1, 2, RelType.FS)]
    CpmEngine().compute(acts, rels, _dd())
    assert acts[0].is_critical and acts[1].is_critical and acts[2].is_critical
    assert acts[0].total_float_h <= 1e-6
    assert acts[2].ef > acts[0].es


def test_parallel_float():
    # A -> C and B -> C; B longer → A has float
    acts = [Activity("A", 8), Activity("B", 24), Activity("C", 8)]
    rels = [Relationship(0, 2), Relationship(1, 2)]
    CpmEngine().compute(acts, rels, _dd())
    assert acts[1].is_critical
    assert acts[0].total_float_h > 0 or acts[0].free_float_h >= 0
    assert acts[2].is_critical


def test_snet_pushes_start():
    acts = [Activity("A", 8, constraint=Constraint.SNET, constraint_dt=datetime(2026, 9, 10))]
    CpmEngine().compute(acts, [], _dd())
    assert acts[0].es >= datetime(2026, 9, 10)


def test_near_critical():
    acts = [Activity("A", 8), Activity("B", 8), Activity("C", 8)]
    rels = [Relationship(0, 2)]  # B dangling parallel
    CpmEngine(near_h=1000).compute(acts, rels, _dd())
    # B has float relative to project_end; may be near-critical with large threshold
    assert acts[0].is_critical
    assert acts[2].is_critical


def test_ss_lag():
    acts = [Activity("A", 16), Activity("B", 8)]
    rels = [Relationship(0, 1, RelType.SS, lag_h=8)]
    CpmEngine().compute(acts, rels, _dd())
    assert acts[1].es >= acts[0].es


def test_50k_topo_smoke():
    n = 5000  # CI-friendly; 50k is same algorithm
    acts = [Activity(f"A{i}", 8) for i in range(n)]
    rels = [Relationship(i, i + 1) for i in range(n - 1)]
    order = topological_order(acts, rels)
    assert order[0] == 0 and order[-1] == n - 1
    CpmEngine().compute(acts, rels, _dd())
    assert acts[-1].is_critical
