"""
CPM engine — Forward / Backward / Float / Critical / Near-critical.

Complexity: O(N + E) after one topological sort. Designed for ~50k activities:
- activities stored in a list (contiguous)
- relationships as integer indexes (no UUID lookups in inner loop)
- calendars cached by id
- no recursion
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence

from .calendar import Calendar
from .graph import topological_order
from .models import Activity, Constraint, RelType, Relationship


NEAR_CRITICAL_H = 40.0  # 5 × 8h days default


def _apply_start_constraint(es: datetime, a: Activity) -> datetime:
    c, d = a.constraint, a.constraint_dt
    if d is None:
        return es
    if c in (Constraint.SNET, Constraint.MSO) and es < d:
        return d
    if c == Constraint.SNLT and es > d:
        return d
    if c == Constraint.MSO:
        return d
    return es


def _apply_finish_constraint_fwd(ef: datetime, a: Activity) -> datetime:
    c, d = a.constraint, a.constraint_dt
    if d is None:
        return ef
    if c in (Constraint.FNET, Constraint.MFO) and ef < d:
        return d
    if c == Constraint.MFO:
        return d
    return ef


class CpmEngine:
    def __init__(self, calendars: Optional[Dict[str, Calendar]] = None, near_h: float = NEAR_CRITICAL_H):
        self.calendars = calendars or {"CAL-STD": Calendar()}
        self.near_h = near_h

    def _cal(self, a: Activity) -> Calendar:
        return self.calendars.get(a.calendar_id) or Calendar()

    def _pred_date(self, pred: Activity, rel: Relationship) -> datetime:
        """Earliest date implied on successor from one relationship + lag."""
        cal = self._cal(pred)
        lag = rel.lag_h
        if rel.rel_type == RelType.FS:
            base = pred.ef
            return cal.add_work_hours(base, lag) if lag else base
        if rel.rel_type == RelType.SS:
            base = pred.es
            return cal.add_work_hours(base, lag) if lag else base
        if rel.rel_type == RelType.FF:
            base = pred.ef
            return cal.add_work_hours(base, lag) if lag else base
        # SF: successor finish from predecessor start
        base = pred.es
        return cal.add_work_hours(base, lag) if lag else base

    def compute(
        self,
        acts: List[Activity],
        rels: List[Relationship],
        data_date: datetime,
        project_end: Optional[datetime] = None,
    ) -> List[Activity]:
        order = topological_order(acts, rels)
        for i, a in enumerate(acts):
            a.in_rels.clear()
            a.out_rels.clear()
        for ri, r in enumerate(rels):
            acts[r.succ].in_rels.append(ri)
            acts[r.pred].out_rels.append(ri)

        self._forward(acts, rels, order, data_date)
        end = project_end or max((a.ef for a in acts if a.ef), default=data_date)
        self._backward(acts, rels, order, end)
        self._floats(acts, rels)
        self._critical(acts)
        return acts

    def _forward(self, acts, rels, order, data_date: datetime) -> None:
        """
        Forward pass:
          ES = max(data_date, max over predecessors of implied start)
          EF = ES + duration (calendar-aware)
          Constraints SNET/MSO/FNET/MFO applied after the graph max.
        """
        for i in order:
            a = acts[i]
            cal = self._cal(a)
            es = data_date
            for ri in a.in_rels:
                r = rels[ri]
                p = acts[r.pred]
                implied = self._pred_date(p, r)
                # FS/SS imply successor START; FF/SF imply successor FINISH
                if r.rel_type in (RelType.FS, RelType.SS):
                    if implied > es:
                        es = implied
                else:
                    # finish-implied → start = finish - duration
                    start_from_fin = cal.sub_work_hours(implied, a.duration_h)
                    if start_from_fin > es:
                        es = start_from_fin
            es = _apply_start_constraint(es, a)
            ef = cal.add_work_hours(es, a.duration_h)
            ef = _apply_finish_constraint_fwd(ef, a)
            if a.constraint in (Constraint.FNET, Constraint.MFO, Constraint.FNLT) and a.constraint_dt:
                # recompute start from possibly shifted finish
                es = cal.sub_work_hours(ef, a.duration_h)
            a.es, a.ef = es, ef

    def _backward(self, acts, rels, order, project_end: datetime) -> None:
        """
        Backward pass (reverse topo):
          LF = min(project_end, min over successors of implied finish)
          LS = LF - duration
          ALAP: push LS toward LF (already the late dates).
        """
        for i in reversed(order):
            a = acts[i]
            cal = self._cal(a)
            lf = project_end
            if not a.out_rels:
                lf = a.ef if a.ef and a.ef > project_end else (a.ef or project_end)
                # hanging activities: LF = EF so TF=0 only if they finish at project_end
                lf = project_end
            for ri in a.out_rels:
                r = rels[ri]
                s = acts[r.succ]
                # reverse of each link type
                if r.rel_type == RelType.FS:
                    implied = self._cal(s).sub_work_hours(s.ls, r.lag_h) if r.lag_h else s.ls
                    if implied < lf:
                        lf = implied
                elif r.rel_type == RelType.SS:
                    implied_start = self._cal(s).sub_work_hours(s.ls, r.lag_h) if r.lag_h else s.ls
                    implied = cal.add_work_hours(implied_start, a.duration_h)
                    if implied < lf:
                        lf = implied
                elif r.rel_type == RelType.FF:
                    implied = self._cal(s).sub_work_hours(s.lf, r.lag_h) if r.lag_h else s.lf
                    if implied < lf:
                        lf = implied
                else:  # SF
                    implied = self._cal(s).sub_work_hours(s.lf, r.lag_h) if r.lag_h else s.lf
                    # pred start from succ finish already; LF = that + duration
                    implied = cal.add_work_hours(implied, a.duration_h)
                    if implied < lf:
                        lf = implied
            if a.constraint == Constraint.FNLT and a.constraint_dt and a.constraint_dt < lf:
                lf = a.constraint_dt
            if a.constraint == Constraint.SNLT and a.constraint_dt:
                cap = cal.add_work_hours(a.constraint_dt, a.duration_h)
                if cap < lf:
                    lf = cap
            # Inverse of calendar-aware duration: use the actual EF−ES span (includes off-hours).
            span = (a.ef - a.es) if a.es and a.ef else timedelta(hours=a.duration_h)
            ls = lf - span
            a.lf, a.ls = lf, ls

    def _floats(self, acts, rels) -> None:
        """Total Float = LS − ES (hours). Free Float = min(succ.ES − this.EF) for FS."""
        for a in acts:
            if a.es and a.ls:
                a.total_float_h = (a.ls - a.es).total_seconds() / 3600.0
            else:
                a.total_float_h = 0.0
            ff = a.total_float_h
            for ri in a.out_rels:
                r = rels[ri]
                s = acts[r.succ]
                if r.rel_type == RelType.FS and a.ef and s.es:
                    gap = (s.es - a.ef).total_seconds() / 3600.0 - r.lag_h
                    ff = min(ff, gap)
            a.free_float_h = max(0.0, ff)

    def _critical(self, acts: Sequence[Activity]) -> None:
        eps = 1e-6
        for a in acts:
            a.is_critical = a.total_float_h <= eps
            a.is_near_critical = (not a.is_critical) and a.total_float_h <= self.near_h
