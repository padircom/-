# PEX CPM Engine (Python)

Forward/Backward pass, Total/Free Float, Critical + Near-Critical, calendar-aware hours, constraints, Kahn topo + cycle.

## 50k activities
O(N+E), integer indexes, iterative queue, no recursion. Inner loop is list access.

## Run tests
```
cd /home/user/arena-platform
PYTHONPATH=. python -m pytest pex/cpm/test_cpm.py -q
```
