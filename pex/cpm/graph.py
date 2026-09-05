"""Topological order (Kahn) + cycle detection. Iterative — safe at 50k nodes."""
from __future__ import annotations

from collections import deque
from typing import List, Sequence, Tuple

from .models import Activity, Relationship


class CycleError(Exception):
    def __init__(self, nodes: Sequence[str]):
        self.nodes = list(nodes)
        super().__init__("cycle: " + " -> ".join(self.nodes[:32]))


def topological_order(acts: List[Activity], rels: List[Relationship]) -> List[int]:
    n = len(acts)
    indeg = [0] * n
    adj: List[List[int]] = [[] for _ in range(n)]
    for r in rels:
        adj[r.pred].append(r.succ)
        indeg[r.succ] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    order: List[int] = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in adj[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(order) != n:
        leftover = [acts[i].code for i in range(n) if indeg[i] > 0]
        raise CycleError(leftover)
    return order
