"""Activity, Relationship, Constraint — pure data, no I/O."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class RelType(str, Enum):
    FS = "FS"
    SS = "SS"
    FF = "FF"
    SF = "SF"


class Constraint(str, Enum):
    ASAP = "ASAP"
    ALAP = "ALAP"
    SNET = "SNET"  # Start No Earlier Than
    SNLT = "SNLT"
    FNET = "FNET"
    FNLT = "FNLT"
    MSO = "MSO"  # Must Start On
    MFO = "MFO"


@dataclass
class Relationship:
    pred: int  # activity index in network
    succ: int
    rel_type: RelType = RelType.FS
    lag_h: float = 0.0


@dataclass
class Activity:
    """Index-based for 50k scale (avoid UUID dict hops in inner loops)."""

    code: str
    duration_h: float
    calendar_id: str = "CAL-STD"
    constraint: Constraint = Constraint.ASAP
    constraint_dt: Optional[datetime] = None
    # computed
    es: Optional[datetime] = None
    ef: Optional[datetime] = None
    ls: Optional[datetime] = None
    lf: Optional[datetime] = None
    total_float_h: float = 0.0
    free_float_h: float = 0.0
    is_critical: bool = False
    is_near_critical: bool = False
    # incoming/outgoing relationship indexes filled by Network
    in_rels: list[int] = field(default_factory=list)
    out_rels: list[int] = field(default_factory=list)
