"""Working calendars — duration is in hours; dates are datetime."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import FrozenSet


@dataclass(frozen=True)
class Calendar:
    """Default: Sat–Wed 8h (Iran-ish site week). Friday off; Thursday 0 unless set."""

    id: str = "CAL-STD"
    hours_per_day: float = 8.0
    workdays: FrozenSet[int] = field(default_factory=lambda: frozenset({5, 6, 0, 1, 2}))
    # datetime.weekday(): Mon=0 … Sun=6. Default Sat(5),Sun(6),Mon,Tue,Wed.
    holidays: FrozenSet[str] = field(default_factory=frozenset)  # YYYY-MM-DD

    def is_work(self, dt: datetime) -> bool:
        if dt.weekday() not in self.workdays:
            return False
        return dt.strftime("%Y-%m-%d") not in self.holidays

    def add_work_hours(self, start: datetime, hours: float) -> datetime:
        """Advance `hours` of working time from `start` (exclusive of non-work)."""
        if hours <= 0:
            return start
        remaining = hours
        cur = start
        # cap iterations for safety on huge calendars
        guard = 0
        max_steps = int(hours / max(self.hours_per_day, 0.25) * 4) + 400
        while remaining > 1e-9:
            guard += 1
            if guard > max_steps:
                return cur + timedelta(hours=remaining)
            if not self.is_work(cur):
                cur = datetime(cur.year, cur.month, cur.day) + timedelta(days=1)
                continue
            day_end = datetime(cur.year, cur.month, cur.day) + timedelta(hours=self.hours_per_day)
            if cur >= day_end:
                cur = datetime(cur.year, cur.month, cur.day) + timedelta(days=1)
                continue
            chunk = min(remaining, (day_end - cur).total_seconds() / 3600.0)
            cur = cur + timedelta(hours=chunk)
            remaining -= chunk
        return cur

    def sub_work_hours(self, finish: datetime, hours: float) -> datetime:
        if hours <= 0:
            return finish
        remaining = hours
        cur = finish
        guard = 0
        max_steps = int(hours / max(self.hours_per_day, 0.25) * 4) + 400
        while remaining > 1e-9:
            guard += 1
            if guard > max_steps:
                return cur - timedelta(hours=remaining)
            if not self.is_work(cur - timedelta(seconds=1)):
                d = datetime(cur.year, cur.month, cur.day)
                cur = d  # midnight → previous day end
                continue
            day_start = datetime(cur.year, cur.month, cur.day)
            if cur <= day_start:
                cur = day_start - timedelta(seconds=1)
                continue
            chunk = min(remaining, (cur - day_start).total_seconds() / 3600.0)
            cur = cur - timedelta(hours=chunk)
            remaining -= chunk
        return cur
