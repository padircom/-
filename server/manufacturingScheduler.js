const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const EPSILON_MINUTES = 0.0005;
const MAX_PLANNED_OPERATIONS = 5_000;
const MAX_SCHEDULE_SEGMENTS = 50_000;
const MAX_CAPACITY_BUCKETS = 50_000;
const FORMATTERS = new Map();

export class SchedulePlanningError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SchedulePlanningError";
    this.code = code;
    this.details = details;
  }
}

function invalid(code, message, details) {
  throw new SchedulePlanningError(code, message, details);
}

function truthy(value) {
  return value === true || value === 1;
}

function dateOnly(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

function instant(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round3(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function dateParts(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function addLocalDays(date, amount) {
  const parts = dateParts(date);
  if (!parts) return null;
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return value.toISOString().slice(0, 10);
}

function weekdayIso(date) {
  const parts = dateParts(date);
  if (!parts) return null;
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

function formatterFor(timeZone) {
  if (!FORMATTERS.has(timeZone)) {
    try {
      FORMATTERS.set(timeZone, new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hourCycle: "h23",
      }));
    } catch {
      invalid("MFG_TIME_ZONE_INVALID", `شناسهٔ منطقهٔ زمانی Work Center معتبر نیست: ${timeZone}`, { timeZone });
    }
  }
  return FORMATTERS.get(timeZone);
}

function localPartsAt(epochMs, timeZone) {
  const values = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year, month: values.month, day: values.day,
    hour: values.hour, minute: values.minute, second: values.second,
  };
}

function localDateAt(epochMs, timeZone) {
  const p = localPartsAt(epochMs, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function localDateTimeToUtc(date, minuteOfDay, timeZone) {
  const p = dateParts(date);
  if (!p || !Number.isFinite(minuteOfDay)) invalid("MFG_CALENDAR_INVALID", "تاریخ یا دقیقهٔ محلی در تقویم معتبر نیست");
  const dayOffset = Math.floor(minuteOfDay / 1440);
  const withinDay = ((minuteOfDay % 1440) + 1440) % 1440;
  const shiftedDate = dateParts(addLocalDays(date, dayOffset));
  const target = Date.UTC(shiftedDate.year, shiftedDate.month - 1, shiftedDate.day, Math.floor(withinDay / 60), withinDay % 60);
  let guess = target;
  for (let attempt = 0; attempt < 6; attempt++) {
    const actual = localPartsAt(guess, timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const difference = target - represented;
    if (difference === 0) break;
    guess += difference;
  }
  return guess;
}

function effectiveOnDate(row, date) {
  const from = dateOnly(row?.EffectiveFrom);
  const to = dateOnly(row?.EffectiveTo);
  return !!from && from <= date && (!row.EffectiveTo || (!!to && to >= date));
}

function subtractInterval(start, end, cutStart, cutEnd) {
  if (cutEnd <= start || cutStart >= end) return [{ start, end }];
  const result = [];
  if (cutStart > start) result.push({ start, end: Math.min(cutStart, end) });
  if (cutEnd < end) result.push({ start: Math.max(cutEnd, start), end });
  return result.filter((item) => item.end > item.start);
}

function calendarIntervals(workCenter, calendarRows, fromMs, toMs) {
  const timeZone = workCenter.TimeZoneId || "UTC";
  formatterFor(timeZone);
  const firstDate = addLocalDays(localDateAt(fromMs, timeZone), -1);
  const lastDate = addLocalDays(localDateAt(toMs - 1, timeZone), 1);
  const all = [];
  const rows = calendarRows.filter((row) => row.WorkCenterId === workCenter.Id);
  const centerEfficiency = finiteNumber(workCenter.EfficiencyPct, 100);
  if (centerEfficiency < 0 || centerEfficiency > 100) {
    invalid("MFG_WORK_CENTER_EFFICIENCY_INVALID", `EfficiencyPct مرکز کاری ${workCenter.Code ?? workCenter.Id} معتبر نیست`);
  }

  for (let date = firstDate; date && date <= lastDate; date = addLocalDays(date, 1)) {
    const effective = rows.filter((row) => effectiveOnDate(row, date));
    const overrides = effective.filter((row) => row.RuleType === "date-override" && dateOnly(row.CalendarDate) === date);
    const candidates = overrides.length
      ? overrides
      : effective.filter((row) => row.RuleType === "weekly" && Number(row.WeekdayIso) === weekdayIso(date));

    for (const calendar of candidates) {
      if (!truthy(calendar.IsWorking)) continue;
      const startMinute = Number(calendar.StartMinuteOfDay);
      const endMinute = Number(calendar.EndMinuteOfDay);
      const breakMinutes = finiteNumber(calendar.BreakMinutes, 0);
      const availabilityPct = finiteNumber(calendar.AvailabilityPct, 100);
      if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || startMinute > 1439 || endMinute <= startMinute || endMinute > 2879 || breakMinutes < 0 || breakMinutes > endMinute - startMinute || availabilityPct < 0 || availabilityPct > 100) {
        invalid("MFG_CALENDAR_INVALID", `شیفت تقویم ${calendar.RuleKey ?? calendar.Id} معتبر نیست`, { calendarId: calendar.Id });
      }
      if (breakMinutes > 0 && (calendar.BreakStartMinuteOfDay === null || calendar.BreakStartMinuteOfDay === undefined)) {
        invalid("MFG_CALENDAR_BREAK_START_REQUIRED", `برای تقویم ${calendar.RuleKey ?? calendar.Id} زمان شروع استراحت الزامی است`, { calendarId: calendar.Id });
      }
      const shiftStart = localDateTimeToUtc(date, startMinute, timeZone);
      const shiftEnd = localDateTimeToUtc(date, endMinute, timeZone);
      let shiftIntervals = [{ start: shiftStart, end: shiftEnd }];
      if (breakMinutes > 0) {
        const breakStartMinute = Number(calendar.BreakStartMinuteOfDay);
        if (!Number.isInteger(breakStartMinute) || breakStartMinute < startMinute || breakStartMinute + breakMinutes > endMinute) {
          invalid("MFG_CALENDAR_INVALID", `بازهٔ استراحت تقویم ${calendar.RuleKey ?? calendar.Id} خارج از شیفت است`, { calendarId: calendar.Id });
        }
        const breakStart = localDateTimeToUtc(date, breakStartMinute, timeZone);
        const breakEnd = localDateTimeToUtc(date, breakStartMinute + breakMinutes, timeZone);
        shiftIntervals = subtractInterval(shiftStart, shiftEnd, breakStart, breakEnd);
      }
      for (const interval of shiftIntervals) {
        all.push({
          ...interval,
          calendarDate: date,
          calendarAvailabilityPct: availabilityPct,
          workCenterId: workCenter.Id,
          shiftCode: calendar.ShiftCode ?? null,
        });
      }
    }
  }

  all.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < all.length; i++) {
    if (all[i].start < all[i - 1].end) {
      invalid("MFG_CALENDAR_OVERLAP", `تقویم مرکز کاری ${workCenter.Code ?? workCenter.Id} دارای شیفت‌های هم‌پوشان است`, {
        workCenterId: workCenter.Id,
        firstCalendarDate: all[i - 1].calendarDate,
        secondCalendarDate: all[i].calendarDate,
      });
    }
  }
  return all.map((interval) => ({
    ...interval,
    start: Math.max(interval.start, fromMs),
    end: Math.min(interval.end, toMs),
  })).filter((interval) => interval.end > interval.start);
}

function resourceActiveOnDate(resource, date) {
  if (!truthy(resource.IsActive)) return false;
  const from = dateOnly(resource.EffectiveFrom);
  const to = dateOnly(resource.EffectiveTo);
  return (!from || from <= date) && (!to || to >= date);
}

function segmentsForOperation(operation, assignment) {
  if (!assignment?.segments?.length) return null;
  const starts = assignment.segments.map((segment) => instant(segment.PlannedStartAt)).filter(Number.isFinite);
  const ends = assignment.segments.map((segment) => instant(segment.PlannedEndAt)).filter(Number.isFinite);
  if (!starts.length || !ends.length) return null;
  return { start: Math.min(...starts), end: Math.max(...ends), operation };
}

function freeWindows(interval, resource, reservations, mode) {
  const start = interval.start;
  const end = interval.end;
  const relevant = reservations.filter((reservation) => {
    if (reservation.workCenterId !== interval.workCenterId) return false;
    if (reservation.start >= end || reservation.end <= start) return false;
    if (reservation.resourceId !== null && reservation.resourceId !== resource.Id) return false;
    if (mode === "semi-finite" && !reservation.firm) return false;
    return true;
  });
  const points = new Set([start, end]);
  for (const reservation of relevant) {
    points.add(Math.max(start, reservation.start));
    points.add(Math.min(end, reservation.end));
  }
  const sorted = [...points].sort((a, b) => a - b);
  const capacityUnits = Math.max(0, finiteNumber(resource.CapacityUnits, 1));
  const windows = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const partStart = sorted[i];
    const partEnd = sorted[i + 1];
    if (partEnd <= partStart) continue;
    const overlapping = relevant.filter((reservation) => reservation.start < partEnd && reservation.end > partStart);
    if (overlapping.some((reservation) => reservation.resourceId === null)) continue;
    const load = overlapping.filter((reservation) => reservation.resourceId === resource.Id).length;
    if (load < capacityUnits) {
      const previous = windows.at(-1);
      if (previous && previous.end === partStart) previous.end = partEnd;
      else windows.push({ start: partStart, end: partEnd });
    }
  }
  return windows;
}

function workFactor(workCenter, interval, resource) {
  const centerPct = finiteNumber(workCenter.EfficiencyPct, 100);
  const resourcePct = finiteNumber(resource.AvailabilityPct, 100);
  return (centerPct / 100) * (interval.calendarAvailabilityPct / 100) * (resourcePct / 100);
}

function buildResourcePlan({
  operation, workCenter, resource, intervals, reservations, mode, direction,
  lowerBound, upperBound, requiredMinutes,
}) {
  const orderedIntervals = direction === "forward" ? intervals : [...intervals].reverse();
  let remaining = requiredMinutes;
  const result = [];
  for (const baseInterval of orderedIntervals) {
    if (remaining <= EPSILON_MINUTES) break;
    if (!resourceActiveOnDate(resource, baseInterval.calendarDate)) continue;
    const interval = {
      ...baseInterval,
      start: Math.max(baseInterval.start, lowerBound),
      end: Math.min(baseInterval.end, upperBound),
    };
    if (interval.end <= interval.start) continue;
    const factor = workFactor(workCenter, interval, resource);
    if (factor <= 0) continue;
    const slots = freeWindows(interval, resource, reservations, mode);
    const orderedSlots = direction === "forward" ? slots : [...slots].reverse();
    for (const slot of orderedSlots) {
      if (remaining <= EPSILON_MINUTES) break;
      const elapsedMinutes = (slot.end - slot.start) / MINUTE_MS;
      const availableWork = elapsedMinutes * factor;
      if (availableWork <= EPSILON_MINUTES) continue;
      const work = Math.min(remaining, availableWork);
      const elapsed = work / factor;
      const start = direction === "forward" ? slot.start : slot.end - elapsed * MINUTE_MS;
      const end = direction === "forward" ? slot.start + elapsed * MINUTE_MS : slot.end;
      if (!(end > start)) continue;
      result.push({
        ProductionOrderOperationId: operation.Id,
        WorkCenterId: workCenter.Id,
        ResourceId: resource.Id,
        PlannedStartAt: new Date(start).toISOString(),
        PlannedEndAt: new Date(end).toISOString(),
        PlannedCapacityMinutes: round3(work),
        QueueMinutes: 0,
        MoveMinutes: 0,
        CapacityMode: mode,
        Direction: direction,
        DispatchRule: operation._dispatchRule,
        Status: "tentative",
      });
      remaining -= work;
    }
  }
  if (remaining > EPSILON_MINUTES) return null;
  result.sort((a, b) => Date.parse(a.PlannedStartAt) - Date.parse(b.PlannedStartAt));
  if (result.length) {
    result[0].QueueMinutes = round3(finiteNumber(operation.PlannedQueueMinutes, 0));
    result[0].MoveMinutes = round3(finiteNumber(operation.PlannedMoveMinutes, 0));
    result.forEach((segment, index) => { segment.SegmentNo = index + 1; });
  }
  return result;
}

function processingMinutes(operation) {
  const supplied = Number(operation.PlannedCapacityMinutes);
  if (Number.isFinite(supplied) && supplied >= 0) return supplied;
  return Math.max(0,
    finiteNumber(operation.PlannedSetupMinutes, 0)
    + finiteNumber(operation.PlannedRunMinutesPerUnit, 0) * finiteNumber(operation.PlannedQuantity, 0),
  );
}

function priorityCompare(rule, direction, fromMs, orderById, remainingByOrder) {
  return (left, right) => {
    const leftOrder = orderById.get(left.ProductionOrderId) ?? {};
    const rightOrder = orderById.get(right.ProductionOrderId) ?? {};
    const leftDue = instant(leftOrder.DueAt) ?? Number.MAX_SAFE_INTEGER;
    const rightDue = instant(rightOrder.DueAt) ?? Number.MAX_SAFE_INTEGER;
    const leftMinutes = processingMinutes(left);
    const rightMinutes = processingMinutes(right);
    let comparison = 0;
    if (rule === "EDD") comparison = leftDue - rightDue;
    else if (rule === "SPT") comparison = leftMinutes - rightMinutes;
    else if (rule === "CR") {
      const leftRemaining = Math.max(0, remainingByOrder.get(left.ProductionOrderId) ?? leftMinutes);
      const rightRemaining = Math.max(0, remainingByOrder.get(right.ProductionOrderId) ?? rightMinutes);
      const leftRatio = (leftDue - fromMs) / MINUTE_MS / Math.max(EPSILON_MINUTES, leftRemaining);
      const rightRatio = (rightDue - fromMs) / MINUTE_MS / Math.max(EPSILON_MINUTES, rightRemaining);
      comparison = leftRatio - rightRatio;
    } else if (rule === "WSPT") {
      const leftWeight = Math.max(Number.MIN_VALUE, finiteNumber(leftOrder.DispatchWeight, 1));
      const rightWeight = Math.max(Number.MIN_VALUE, finiteNumber(rightOrder.DispatchWeight, 1));
      comparison = (rightWeight / Math.max(EPSILON_MINUTES, rightMinutes)) - (leftWeight / Math.max(EPSILON_MINUTES, leftMinutes));
    } else if (rule === "FIFO") {
      comparison = (instant(leftOrder.CreatedAt) ?? Number.MAX_SAFE_INTEGER) - (instant(rightOrder.CreatedAt) ?? Number.MAX_SAFE_INTEGER);
    } else if (rule === "MANUAL") {
      const leftRank = leftOrder.ManualRank === null || leftOrder.ManualRank === undefined || !Number.isFinite(Number(leftOrder.ManualRank))
        ? Number.MAX_SAFE_INTEGER
        : Number(leftOrder.ManualRank);
      const rightRank = rightOrder.ManualRank === null || rightOrder.ManualRank === undefined || !Number.isFinite(Number(rightOrder.ManualRank))
        ? Number.MAX_SAFE_INTEGER
        : Number(rightOrder.ManualRank);
      comparison = leftRank - rightRank;
    }
    if (comparison !== 0) return comparison;
    comparison = leftDue - rightDue;
    if (comparison !== 0) return comparison;
    comparison = String(leftOrder.OrderNo ?? "").localeCompare(String(rightOrder.OrderNo ?? ""));
    if (comparison !== 0) return comparison;
    comparison = Number(left.SequenceNo ?? 0) - Number(right.SequenceNo ?? 0);
    if (comparison !== 0) return comparison;
    return String(left.Id).localeCompare(String(right.Id)) * (direction === "backward" ? -1 : 1);
  };
}

function dailyBucketDates(workCenter, fromMs, toMs) {
  const zone = workCenter.TimeZoneId || "UTC";
  let current = localDateAt(fromMs, zone);
  const end = localDateAt(toMs - 1, zone);
  const dates = [];
  while (current && current <= end) {
    dates.push(current);
    current = addLocalDays(current, 1);
  }
  return dates;
}

function splitLoadByLocalDate(segment, timeZone, fromMs, toMs) {
  const start = instant(segment.PlannedStartAt);
  const end = instant(segment.PlannedEndAt);
  if (start === null || end === null || end <= start) return [];
  const clippedStart = Math.max(start, fromMs);
  const clippedEnd = Math.min(end, toMs);
  if (clippedEnd <= clippedStart) return [];
  const totalElapsed = end - start;
  const totalCapacity = finiteNumber(segment.PlannedCapacityMinutes, (end - start) / MINUTE_MS);
  const result = [];
  let cursor = clippedStart;
  while (cursor < clippedEnd) {
    const date = localDateAt(cursor, timeZone);
    const nextDate = addLocalDays(date, 1);
    const nextMidnight = localDateTimeToUtc(nextDate, 0, timeZone);
    const boundary = Math.min(clippedEnd, nextMidnight);
    const minutes = totalCapacity * ((boundary - cursor) / totalElapsed);
    result.push({ date, minutes: Math.max(0, minutes) });
    cursor = boundary;
  }
  return result;
}

function availableElapsedAfterDowntime(start, end, workCenterId, resourceId, downtimeReservations) {
  const blocks = downtimeReservations
    .filter((reservation) => reservation.workCenterId === workCenterId
      && (reservation.resourceId === null || reservation.resourceId === resourceId)
      && reservation.start < end && reservation.end > start)
    .map((reservation) => ({ start: Math.max(start, reservation.start), end: Math.min(end, reservation.end) }))
    .sort((left, right) => left.start - right.start);
  let blocked = 0;
  let blockStart = null;
  let blockEnd = null;
  for (const block of blocks) {
    if (blockStart === null) {
      blockStart = block.start;
      blockEnd = block.end;
    } else if (block.start <= blockEnd) {
      blockEnd = Math.max(blockEnd, block.end);
    } else {
      blocked += blockEnd - blockStart;
      blockStart = block.start;
      blockEnd = block.end;
    }
  }
  if (blockStart !== null) blocked += blockEnd - blockStart;
  return Math.max(0, end - start - blocked);
}

function createCapacityRows({ workCenters, resourcesByCenter, intervalsByCenter, scheduleSegments, downtimeReservations, fromMs, toMs, plantId, scheduleVersion }) {
  const bucketCount = workCenters.reduce((sum, workCenter) => sum + dailyBucketDates(workCenter, fromMs, toMs).length, 0);
  if (bucketCount > MAX_CAPACITY_BUCKETS) {
    invalid("MFG_SCHEDULE_CAPACITY_BUCKET_LIMIT", `هر اجرا حداکثر ${MAX_CAPACITY_BUCKETS} bucket ظرفیت می‌سازد`);
  }
  const rows = [];
  for (const workCenter of workCenters) {
    const zone = workCenter.TimeZoneId || "UTC";
    const wcResources = resourcesByCenter.get(workCenter.Id) ?? [];
    const intervals = intervalsByCenter.get(workCenter.Id) ?? [];
    const dates = dailyBucketDates(workCenter, fromMs, toMs);
    const centerEfficiency = finiteNumber(workCenter.EfficiencyPct, 100) / 100;
    for (const date of dates) {
      const bucketStart = localDateTimeToUtc(date, 0, zone);
      const bucketEnd = localDateTimeToUtc(addLocalDays(date, 1), 0, zone);
      let availableMinutes = 0;
      for (const interval of intervals) {
        const overlapStart = Math.max(interval.start, bucketStart, fromMs);
        const overlapEnd = Math.min(interval.end, bucketEnd, toMs);
        if (overlapEnd <= overlapStart) continue;
        for (const resource of wcResources) {
          if (!resourceActiveOnDate(resource, date)) continue;
          const availableElapsed = availableElapsedAfterDowntime(overlapStart, overlapEnd, workCenter.Id, resource.Id, downtimeReservations);
          const elapsedMinutes = availableElapsed / MINUTE_MS;
          const units = Math.max(0, finiteNumber(resource.CapacityUnits, 1));
          const resourcePct = finiteNumber(resource.AvailabilityPct, 100) / 100;
          availableMinutes += elapsedMinutes * centerEfficiency * (interval.calendarAvailabilityPct / 100) * resourcePct * units;
        }
      }
      let plannedLoadMinutes = 0;
      let reservedMinutes = 0;
      for (const segment of scheduleSegments) {
        if (segment.WorkCenterId !== workCenter.Id) continue;
        for (const portion of splitLoadByLocalDate(segment, zone, fromMs, toMs)) {
          if (portion.date !== date) continue;
          plannedLoadMinutes += portion.minutes;
          if (segment.Status === "firm") reservedMinutes += portion.minutes;
        }
      }
      const available = Math.max(0, round3(availableMinutes));
      const load = Math.max(0, round3(plannedLoadMinutes));
      const reserved = Math.max(0, round3(reservedMinutes));
      const overload = Math.max(0, round3(load - available));
      rows.push({
        PlantId: plantId,
        WorkCenterId: workCenter.Id,
        ScheduleVersion: scheduleVersion,
        PeriodStart: new Date(bucketStart).toISOString(),
        PeriodEnd: new Date(bucketEnd).toISOString(),
        AvailableMinutes: available,
        PlannedLoadMinutes: load,
        ReservedMinutes: reserved,
        UtilizationPct: available === 0 ? null : Math.min(9999.999, round3((load / available) * 100)),
        OverloadMinutes: overload,
        IsBottleneck: overload > 0,
        CalculatedAt: new Date().toISOString(),
        ModelVersion: "mfg-scheduler-v1",
      });
    }
  }
  return rows;
}

function assignmentFrom(operation, order, segments, preserved = false) {
  const sorted = [...segments].sort((a, b) => Date.parse(a.PlannedStartAt) - Date.parse(b.PlannedStartAt));
  return {
    ProductionOrderOperationId: operation.Id,
    ProductionOrderId: order?.Id ?? operation.ProductionOrderId,
    OrderNo: order?.OrderNo ?? null,
    SequenceNo: operation.SequenceNo,
    WorkCenterId: operation.WorkCenterId,
    ResourceId: sorted[0]?.ResourceId ?? null,
    PlannedStartAt: sorted[0]?.PlannedStartAt ?? null,
    PlannedEndAt: sorted.at(-1)?.PlannedEndAt ?? null,
    PlannedCapacityMinutes: round3(sorted.reduce((sum, segment) => sum + finiteNumber(segment.PlannedCapacityMinutes, 0), 0)),
    Status: sorted[0]?.Status === "firm" ? "firm" : preserved ? "preserved" : "tentative",
    Preserved: preserved,
    Segments: sorted.map(({ _orderId, _preserved, ...segment }) => segment),
  };
}

function summarizeScheduleSegments(segments = []) {
  const normalized = [...segments]
    .filter((segment) => segment && segment.Status !== "cancelled" && instant(segment.PlannedStartAt) !== null && instant(segment.PlannedEndAt) !== null)
    .sort((left, right) => instant(left.PlannedStartAt) - instant(right.PlannedStartAt)
      || instant(left.PlannedEndAt) - instant(right.PlannedEndAt)
      || Number(left.SegmentNo ?? 0) - Number(right.SegmentNo ?? 0))
    .map((segment, index) => ({
      SegmentNo: Number(segment.SegmentNo) > 0 ? Number(segment.SegmentNo) : index + 1,
      WorkCenterId: segment.WorkCenterId,
      ResourceId: segment.ResourceId ?? null,
      PlannedStartAt: new Date(instant(segment.PlannedStartAt)).toISOString(),
      PlannedEndAt: new Date(instant(segment.PlannedEndAt)).toISOString(),
      PlannedCapacityMinutes: round3(finiteNumber(segment.PlannedCapacityMinutes, 0)),
      QueueMinutes: round3(finiteNumber(segment.QueueMinutes, 0)),
      MoveMinutes: round3(finiteNumber(segment.MoveMinutes, 0)),
      Status: segment.Status ?? "tentative",
    }));
  if (!normalized.length) return null;
  return {
    WorkCenterId: normalized[0].WorkCenterId,
    ResourceId: normalized[0].ResourceId ?? null,
    PlannedStartAt: normalized[0].PlannedStartAt,
    PlannedEndAt: normalized.at(-1).PlannedEndAt,
    PlannedCapacityMinutes: round3(normalized.reduce((sum, item) => sum + item.PlannedCapacityMinutes, 0)),
    SegmentCount: normalized.length,
    Status: normalized.some((item) => item.Status === "firm") ? "firm" : normalized[0].Status,
    Segments: normalized,
  };
}

function normalizedSegmentsEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    const a = left[index];
    const b = right[index];
    if (
      a.WorkCenterId !== b.WorkCenterId
      || (a.ResourceId ?? null) !== (b.ResourceId ?? null)
      || Date.parse(a.PlannedStartAt) !== Date.parse(b.PlannedStartAt)
      || Date.parse(a.PlannedEndAt) !== Date.parse(b.PlannedEndAt)
      || round3(a.PlannedCapacityMinutes) !== round3(b.PlannedCapacityMinutes)
      || a.Status !== b.Status
    ) {
      return false;
    }
  }
  return true;
}

export function diffManufacturingSchedules({
  previousScheduleVersion = 0,
  scheduleVersion,
  operations = [],
  orders = [],
  previousSegments = [],
  currentSegments = [],
  requestedOperationIds = [],
  rescheduledOperationIds = [],
  preservedOperationIds = new Set(),
}) {
  const orderById = new Map(orders.map((order) => [order.Id, order]));
  const previousByOperation = new Map();
  for (const segment of previousSegments) {
    if (!segment || segment.Status === "cancelled") continue;
    const opId = segment.ProductionOrderOperationId;
    if (!previousByOperation.has(opId)) previousByOperation.set(opId, []);
    previousByOperation.get(opId).push(segment);
  }
  const currentByOperation = new Map();
  for (const segment of currentSegments) {
    if (!segment || segment.Status === "cancelled") continue;
    const opId = segment.ProductionOrderOperationId;
    if (!currentByOperation.has(opId)) currentByOperation.set(opId, []);
    currentByOperation.get(opId).push(segment);
  }

  const rescheduledSet = new Set(rescheduledOperationIds);
  const preservedSet = preservedOperationIds instanceof Set ? preservedOperationIds : new Set(preservedOperationIds);
  const sortedOperations = [...operations].sort((left, right) => {
    const leftOrder = orderById.get(left.ProductionOrderId);
    const rightOrder = orderById.get(right.ProductionOrderId);
    return String(leftOrder?.OrderNo ?? "").localeCompare(String(rightOrder?.OrderNo ?? ""))
      || Number(left.SequenceNo ?? 0) - Number(right.SequenceNo ?? 0)
      || String(left.Id).localeCompare(String(right.Id));
  });

  const operationDiffs = sortedOperations.map((operation) => {
    const order = orderById.get(operation.ProductionOrderId);
    const before = summarizeScheduleSegments(previousByOperation.get(operation.Id) ?? []);
    const after = summarizeScheduleSegments(currentByOperation.get(operation.Id) ?? []);
    let changeType = "unchanged";
    let changed = false;
    if (!before && after) {
      changeType = "added";
      changed = true;
    } else if (before && !after) {
      changeType = "removed";
      changed = true;
    } else if (before && after && !normalizedSegmentsEqual(before.Segments, after.Segments)) {
      changeType = "moved";
      changed = true;
    }
    const startDeltaMinutes = before && after
      ? round3((Date.parse(after.PlannedStartAt) - Date.parse(before.PlannedStartAt)) / MINUTE_MS)
      : null;
    const endDeltaMinutes = before && after
      ? round3((Date.parse(after.PlannedEndAt) - Date.parse(before.PlannedEndAt)) / MINUTE_MS)
      : null;
    return {
      ProductionOrderOperationId: operation.Id,
      ProductionOrderId: order?.Id ?? operation.ProductionOrderId,
      OrderNo: order?.OrderNo ?? null,
      SequenceNo: operation.SequenceNo,
      OperationCode: operation.OperationCode ?? null,
      WorkCenterId: after?.WorkCenterId ?? before?.WorkCenterId ?? operation.WorkCenterId,
      ChangeType: changeType,
      Changed: changed,
      Rescheduled: rescheduledSet.has(operation.Id),
      Preserved: preservedSet.has(operation.Id),
      PreviousResourceId: before?.ResourceId ?? null,
      CurrentResourceId: after?.ResourceId ?? null,
      PreviousPlannedStartAt: before?.PlannedStartAt ?? null,
      CurrentPlannedStartAt: after?.PlannedStartAt ?? null,
      PreviousPlannedEndAt: before?.PlannedEndAt ?? null,
      CurrentPlannedEndAt: after?.PlannedEndAt ?? null,
      StartDeltaMinutes: startDeltaMinutes,
      EndDeltaMinutes: endDeltaMinutes,
      before,
      after,
    };
  });

  const changedOperations = operationDiffs.filter((item) => item.Changed);
  return {
    fromScheduleVersion: previousScheduleVersion,
    toScheduleVersion: scheduleVersion,
    requestedOperationIds: [...requestedOperationIds],
    rescheduledOperationIds: [...rescheduledOperationIds],
    changedOperationCount: changedOperations.length,
    unchangedOperationCount: operationDiffs.length - changedOperations.length,
    addedCount: operationDiffs.filter((item) => item.ChangeType === "added").length,
    removedCount: operationDiffs.filter((item) => item.ChangeType === "removed").length,
    movedCount: operationDiffs.filter((item) => item.ChangeType === "moved").length,
    operations: operationDiffs,
    changedOperations,
  };
}

function validatePredecessors(operations) {
  const operationById = new Map(operations.map((operation) => [operation.Id, operation]));
  const successors = new Map(operations.map((operation) => [operation.Id, []]));
  const indegree = new Map(operations.map((operation) => [operation.Id, 0]));
  for (const operation of operations) {
    const predecessorId = operation.PredecessorOperationId;
    if (!predecessorId) continue;
    const predecessor = operationById.get(predecessorId);
    if (!predecessor || predecessor.ProductionOrderId !== operation.ProductionOrderId || predecessor.PlantId !== operation.PlantId) {
      invalid("MFG_OPERATION_PREDECESSOR_INVALID", `پیش‌نیاز Operation ${operation.Id} باید در همان سفارش و کارخانه باشد`, { operationId: operation.Id });
    }
    successors.get(predecessorId).push(operation.Id);
    indegree.set(operation.Id, 1);
  }
  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    visited++;
    for (const successorId of successors.get(id) ?? []) {
      indegree.set(successorId, indegree.get(successorId) - 1);
      if (indegree.get(successorId) === 0) queue.push(successorId);
    }
  }
  if (visited !== operations.length) invalid("MFG_OPERATION_PREDECESSOR_CYCLE", "چرخه در پیش‌نیازهای عملیات سفارش تشخیص داده شد");
  return { operationById, successors };
}

export function planManufacturingSchedule({
  plantId,
  direction,
  capacityMode,
  dispatchRule,
  fromMs,
  toMs,
  previousScheduleVersion = 0,
  scheduleVersion,
  orders,
  operations,
  workCenters,
  resources,
  calendars,
  existingSchedules = [],
  executions = [],
  downtime = [],
  selectedOrderIds,
  selectedOperationIds,
}) {
  const allOrderById = new Map(orders.map((order) => [order.Id, order]));
  const activeOrders = orders.filter((order) => order.PlantId === plantId && ["released", "in-progress"].includes(order.Status));
  const orderById = new Map(activeOrders.map((order) => [order.Id, order]));

  const hasExplicitOperationSelection = selectedOperationIds !== undefined && selectedOperationIds !== null;
  const requestedOperationIdList = hasExplicitOperationSelection ? [...selectedOperationIds] : [];
  if (hasExplicitOperationSelection) {
    if (requestedOperationIdList.length === 0) {
      invalid("MFG_SCHEDULE_OPERATION_EMPTY", "حداقل یک شناسهٔ عملیات برای باززمان‌بندی الزامی است");
    }
    const allOperationById = new Map(operations.map((operation) => [operation.Id, operation]));
    for (const operationId of requestedOperationIdList) {
      const operation = allOperationById.get(operationId);
      if (!operation || operation.PlantId !== plantId) {
        invalid("MFG_OPERATION_NOT_FOUND", `عملیات ${operationId} در کارخانهٔ جاری یافت نشد`, { operationId });
      }
      const order = allOrderById.get(operation.ProductionOrderId);
      if (!order || order.PlantId !== plantId || !["released", "in-progress"].includes(order.Status)) {
        invalid("MFG_ORDER_NOT_RELEASED", `سفارش عملیات ${operation.OperationCode ?? operation.Id} آزادشده یا درحال‌تولید نیست`, {
          operationId: operation.Id,
          orderId: operation.ProductionOrderId,
        });
      }
      if (!["pending", "queued", "ready"].includes(operation.Status)) {
        invalid("MFG_OPERATION_NOT_DISPATCHABLE", `عملیات ${operation.OperationCode ?? operation.Id} در وضعیت ${operation.Status} قابل‌اعزام نیست`, {
          operationId: operation.Id,
          orderId: order.Id,
          status: operation.Status,
        });
      }
    }
  }

  const operationsInScope = operations.filter((operation) => orderById.has(operation.ProductionOrderId));
  if (operationsInScope.length > MAX_PLANNED_OPERATIONS) {
    invalid("MFG_SCHEDULE_OPERATION_LIMIT", `در هر اجرا حداکثر ${MAX_PLANNED_OPERATIONS} عملیات زمان‌بندی می‌شود`);
  }
  const { operationById, successors } = validatePredecessors(operationsInScope);
  const workCenterRows = workCenters.filter((workCenter) => workCenter.PlantId === plantId);
  const allWorkCentersById = new Map(workCenterRows.map((workCenter) => [workCenter.Id, workCenter]));
  const activeWorkCenters = workCenterRows.filter((workCenter) => workCenter.Status === "active");
  const workCenterById = new Map(activeWorkCenters.map((workCenter) => [workCenter.Id, workCenter]));
  for (const operation of operationsInScope) {
    const center = allWorkCentersById.get(operation.WorkCenterId);
    if (!center || center.PlantId !== operation.PlantId || operation.PlantId !== plantId) {
      invalid("MFG_WORK_CENTER_UNAVAILABLE", `مرکز کاری Operation ${operation.Id} متعلق به همین کارخانه نیست یا یافت نشد`, { operationId: operation.Id });
    }
  }

  const resourcesByCenter = new Map();
  for (const resource of resources) {
    if (resource.PlantId !== plantId || !workCenterById.has(resource.WorkCenterId) || !truthy(resource.IsActive)) continue;
    const capacityUnits = finiteNumber(resource.CapacityUnits, 0);
    const availabilityPct = finiteNumber(resource.AvailabilityPct, 100);
    if (capacityUnits <= 0 || availabilityPct < 0 || availabilityPct > 100) {
      invalid("MFG_WORK_CENTER_RESOURCE_INVALID", `ظرفیت منبع ${resource.ResourceCode ?? resource.Id} معتبر نیست`, { resourceId: resource.Id });
    }
    if (!resourcesByCenter.has(resource.WorkCenterId)) resourcesByCenter.set(resource.WorkCenterId, []);
    resourcesByCenter.get(resource.WorkCenterId).push(resource);
  }
  for (const list of resourcesByCenter.values()) list.sort((a, b) => String(a.ResourceCode ?? "").localeCompare(String(b.ResourceCode ?? "")) || String(a.Id).localeCompare(String(b.Id)));

  const intervalsByCenter = new Map();
  for (const workCenter of activeWorkCenters) {
    intervalsByCenter.set(workCenter.Id, calendarIntervals(workCenter, calendars, fromMs, toMs));
  }

  const completedByOperation = new Map();
  for (const execution of executions) {
    if (execution.PlantId !== plantId || execution.Status !== "completed") continue;
    const finishedAt = instant(execution.FinishedAt);
    if (finishedAt === null) continue;
    const previous = completedByOperation.get(execution.ProductionOrderOperationId);
    if (!previous || finishedAt > previous.finishedAt) {
      completedByOperation.set(execution.ProductionOrderOperationId, { startedAt: instant(execution.StartedAt), finishedAt });
    }
  }

  const currentOperationIds = new Set(operationsInScope.map((operation) => operation.Id));
  const existingScheduledOpIds = new Set();
  const existingFirmOpIds = new Set();
  for (const existing of existingSchedules) {
    if (existing.PlantId !== plantId || existing.Status === "cancelled") continue;
    const operation = operationById.get(existing.ProductionOrderOperationId);
    const order = operation && orderById.get(operation.ProductionOrderId);
    if (!operation || !order || !currentOperationIds.has(operation.Id)) continue;
    const start = instant(existing.PlannedStartAt);
    const end = instant(existing.PlannedEndAt);
    if (start === null || end === null || end <= start) continue;
    existingScheduledOpIds.add(operation.Id);
    if (existing.Status === "firm") existingFirmOpIds.add(operation.Id);
  }
  const hasExistingTiming = (operationId) =>
    existingScheduledOpIds.has(operationId)
    || (operationById.get(operationId)?.Status === "completed" && completedByOperation.has(operationId));

  const effectiveSelectedOrderIds = selectedOrderIds instanceof Set
    ? selectedOrderIds
    : new Set(selectedOrderIds ?? activeOrders.map((order) => order.Id));

  const targetOperationIds = new Set();
  if (hasExplicitOperationSelection) {
    const queue = [...requestedOperationIdList];
    while (queue.length) {
      const currentId = queue.shift();
      if (!currentId || targetOperationIds.has(currentId)) continue;
      const currentOp = operationById.get(currentId);
      if (!currentOp) continue;
      targetOperationIds.add(currentId);

      const predecessorId = currentOp.PredecessorOperationId;
      if (predecessorId && !targetOperationIds.has(predecessorId)) {
        const predecessor = operationById.get(predecessorId);
        if (predecessor && predecessor.Status !== "completed" && !existingFirmOpIds.has(predecessorId)) {
          if (direction === "backward" || !hasExistingTiming(predecessorId)) {
            queue.push(predecessorId);
          }
        }
      }
    }
    const downQueue = [...targetOperationIds];
    while (downQueue.length) {
      const currentId = downQueue.shift();
      const currentOp = operationById.get(currentId);
      if (!currentOp || currentOp.Status === "completed" || existingFirmOpIds.has(currentId)) continue;
      for (const successorId of successors.get(currentId) ?? []) {
        const successor = operationById.get(successorId);
        if (!successor || successor.Status === "completed" || existingFirmOpIds.has(successorId)) continue;
        if (direction === "forward" || !hasExistingTiming(successorId)) {
          if (!targetOperationIds.has(successorId)) {
            targetOperationIds.add(successorId);
            downQueue.push(successorId);
          }
        }
      }
    }
  } else {
    for (const operation of operationsInScope) {
      if (effectiveSelectedOrderIds.has(operation.ProductionOrderId)) {
        targetOperationIds.add(operation.Id);
      }
    }
  }

  const operationSegments = new Map();
  const reservations = [];
  const downtimeReservations = [];
  for (const event of downtime) {
    if (event.PlantId !== plantId || !workCenterById.has(event.WorkCenterId)) continue;
    const eventStart = instant(event.StartedAt);
    const eventEnd = event.FinishedAt === null || event.FinishedAt === undefined ? toMs : instant(event.FinishedAt);
    if (eventStart === null || eventEnd === null || eventEnd <= fromMs || eventStart >= toMs || eventEnd <= eventStart) continue;
    const reservation = {
      workCenterId: event.WorkCenterId,
      resourceId: event.ResourceId ?? null,
      start: Math.max(fromMs, eventStart),
      end: Math.min(toMs, eventEnd),
      firm: true,
      downtime: true,
    };
    downtimeReservations.push(reservation);
    reservations.push(reservation);
  }
  const copiedSegments = [];
  for (const existing of existingSchedules) {
    if (existing.PlantId !== plantId || existing.Status === "cancelled") continue;
    const operation = operationById.get(existing.ProductionOrderOperationId);
    const order = operation && orderById.get(operation.ProductionOrderId);
    if (!operation || !order || !currentOperationIds.has(operation.Id)) continue;
    const isSelected = targetOperationIds.has(operation.Id);
    const keep = isSelected
      ? existing.Status === "firm"
      : ["released", "in-progress"].includes(order.Status);
    if (!keep) continue;
    const segment = {
      ProductionOrderOperationId: existing.ProductionOrderOperationId,
      WorkCenterId: existing.WorkCenterId,
      ResourceId: existing.ResourceId ?? null,
      PlannedStartAt: existing.PlannedStartAt,
      PlannedEndAt: existing.PlannedEndAt,
      PlannedCapacityMinutes: round3(finiteNumber(existing.PlannedCapacityMinutes, 0)),
      QueueMinutes: round3(finiteNumber(existing.QueueMinutes, 0)),
      MoveMinutes: round3(finiteNumber(existing.MoveMinutes, 0)),
      CapacityMode: existing.CapacityMode,
      Direction: existing.Direction,
      DispatchRule: existing.DispatchRule,
      Status: existing.Status,
      SegmentNo: existing.SegmentNo,
    };
    const start = instant(segment.PlannedStartAt);
    const end = instant(segment.PlannedEndAt);
    if (start === null || end === null || end <= start) continue;
    if (copiedSegments.length >= MAX_SCHEDULE_SEGMENTS) {
      invalid("MFG_SCHEDULE_SEGMENT_LIMIT", `هر اجرا حداکثر ${MAX_SCHEDULE_SEGMENTS} قطعهٔ زمان‌بندی را نگه می‌دارد`);
    }
    copiedSegments.push(segment);
    if (!operationSegments.has(operation.Id)) operationSegments.set(operation.Id, []);
    operationSegments.get(operation.Id).push(segment);
    reservations.push({
      operationId: operation.Id,
      workCenterId: segment.WorkCenterId,
      resourceId: segment.ResourceId,
      start,
      end,
      firm: segment.Status === "firm",
    });
  }

  const fixedOperationIds = new Set();
  for (const [operationId, segments] of operationSegments) {
    if (segments.some((segment) => segment.Status === "firm")) fixedOperationIds.add(operationId);
  }
  const preservedOperationIds = new Set();
  const states = new Map();
  const scheduledTimes = new Map();
  const unscheduled = [];
  const assignmentsByOperation = new Map();
  const allStoredSegments = [...copiedSegments];
  const markFailed = (operation, reason) => {
    const currentState = states.get(operation.Id);
    if (currentState?.status === "failed") return;
    states.set(operation.Id, { status: "failed", reason });
    const order = orderById.get(operation.ProductionOrderId);
    unscheduled.push({
      ProductionOrderOperationId: operation.Id,
      ProductionOrderId: order?.Id ?? operation.ProductionOrderId,
      OrderNo: order?.OrderNo ?? null,
      WorkCenterId: operation.WorkCenterId,
      Reason: reason,
    });
    if (direction !== "backward") return;

    const queue = [...(successors.get(operation.Id) ?? [])];
    const visited = new Set();
    while (queue.length) {
      const successorId = queue.shift();
      if (visited.has(successorId)) continue;
      visited.add(successorId);
      const state = states.get(successorId);
      if (state?.status === "done" && state.planned) {
        const successor = operationById.get(successorId);
        const successorOrder = successor && orderById.get(successor.ProductionOrderId);
        states.set(successorId, { status: "failed", reason: "PREDECESSOR_UNSCHEDULED" });
        scheduledTimes.delete(successorId);
        operationSegments.delete(successorId);
        assignmentsByOperation.delete(successorId);
        for (let i = allStoredSegments.length - 1; i >= 0; i--) {
          if (allStoredSegments[i].ProductionOrderOperationId === successorId) allStoredSegments.splice(i, 1);
        }
        for (let i = reservations.length - 1; i >= 0; i--) {
          if (reservations[i].operationId === successorId) reservations.splice(i, 1);
        }
        unscheduled.push({
          ProductionOrderOperationId: successorId,
          ProductionOrderId: successorOrder?.Id ?? successor?.ProductionOrderId,
          OrderNo: successorOrder?.OrderNo ?? null,
          WorkCenterId: successor?.WorkCenterId ?? null,
          Reason: "PREDECESSOR_UNSCHEDULED",
        });
        queue.push(...(successors.get(successorId) ?? []));
      } else if (state?.status === "failed") {
        queue.push(...(successors.get(successorId) ?? []));
      }
    }
  };

  for (const operation of operationsInScope) {
    const order = orderById.get(operation.ProductionOrderId);
    if (!targetOperationIds.has(operation.Id)) {
      preservedOperationIds.add(operation.Id);
      states.set(operation.Id, { status: "done", fixed: true });
      const segments = operationSegments.get(operation.Id) ?? [];
      const timing = segmentsForOperation(operation, { segments });
      if (timing) scheduledTimes.set(operation.Id, timing);
      else if (operation.Status === "completed") {
        const execution = completedByOperation.get(operation.Id);
        if (execution) scheduledTimes.set(operation.Id, { start: execution.startedAt, end: execution.finishedAt, operation });
      }
      continue;
    }
    if (operation.Status === "completed") {
      preservedOperationIds.add(operation.Id);
      states.set(operation.Id, { status: "done", completed: true });
      const execution = completedByOperation.get(operation.Id);
      if (execution) scheduledTimes.set(operation.Id, { start: execution.startedAt, end: execution.finishedAt, operation });
      continue;
    }
    if (fixedOperationIds.has(operation.Id)) {
      preservedOperationIds.add(operation.Id);
      states.set(operation.Id, { status: "done", fixed: true });
      const segments = operationSegments.get(operation.Id) ?? [];
      const timing = segmentsForOperation(operation, { segments });
      if (timing) scheduledTimes.set(operation.Id, timing);
      assignmentsByOperation.set(operation.Id, assignmentFrom(operation, order, segments, true));
      continue;
    }
    if (["pending", "queued", "ready"].includes(operation.Status) && allWorkCentersById.get(operation.WorkCenterId)?.Status !== "active") {
      states.set(operation.Id, { status: "failed", reason: "WORK_CENTER_UNAVAILABLE" });
      unscheduled.push({
        ProductionOrderOperationId: operation.Id,
        ProductionOrderId: order.Id,
        OrderNo: order.OrderNo,
        WorkCenterId: operation.WorkCenterId,
        Reason: "WORK_CENTER_UNAVAILABLE",
      });
      continue;
    }
    if (!["pending", "queued", "ready"].includes(operation.Status)) {
      const reason = operation.Status === "blocked" ? "OPERATION_BLOCKED" : "OPERATION_NOT_DISPATCHABLE";
      states.set(operation.Id, { status: "failed", reason });
      unscheduled.push({
        ProductionOrderOperationId: operation.Id,
        ProductionOrderId: order.Id,
        OrderNo: order.OrderNo,
        WorkCenterId: operation.WorkCenterId,
        Reason: reason,
      });
      continue;
    }
    states.set(operation.Id, { status: "pending" });
  }

  const remainingByOrder = new Map();
  for (const operation of operationsInScope) {
    if (!targetOperationIds.has(operation.Id) || fixedOperationIds.has(operation.Id) || !["pending", "queued", "ready"].includes(operation.Status)) continue;
    remainingByOrder.set(operation.ProductionOrderId, (remainingByOrder.get(operation.ProductionOrderId) ?? 0) + processingMinutes(operation));
  }
  const operationsById = new Map(operationsInScope.map((operation) => [operation.Id, operation]));
  const fixedSuccessorUpperBound = (opId) => {
    let bound = Infinity;
    for (const succId of successors.get(opId) ?? []) {
      const succ = operationsById.get(succId);
      if (!succ) continue;
      const lagMs = (finiteNumber(succ.PlannedQueueMinutes, 0) + finiteNumber(succ.PlannedMoveMinutes, 0)) * MINUTE_MS;
      const succTime = scheduledTimes.get(succId);
      if (succTime && Number.isFinite(succTime.start)) {
        bound = Math.min(bound, succTime.start - lagMs);
      } else {
        const downstreamBound = fixedSuccessorUpperBound(succId);
        if (Number.isFinite(downstreamBound)) {
          bound = Math.min(bound, downstreamBound - processingMinutes(succ) * MINUTE_MS - lagMs);
        }
      }
    }
    return bound;
  };
  const compare = priorityCompare(dispatchRule, direction, fromMs, orderById, remainingByOrder);
  const planableCount = [...states.values()].filter((state) => state.status === "pending").length;
  let processed = 0;
  while (processed < planableCount) {
    const pending = operationsInScope.filter((operation) => states.get(operation.Id)?.status === "pending");
    const ready = pending.filter((operation) => {
      if (direction === "forward") {
        const predecessorId = operation.PredecessorOperationId;
        return !predecessorId || ["done", "failed"].includes(states.get(predecessorId)?.status);
      }
      const nextOperations = successors.get(operation.Id) ?? [];
      return nextOperations.every((successorId) => ["done", "failed"].includes(states.get(successorId)?.status));
    }).sort(compare);

    if (!ready.length) {
      for (const operation of pending) {
        states.set(operation.Id, { status: "failed", reason: "DEPENDENCY_UNRESOLVED" });
        const order = orderById.get(operation.ProductionOrderId);
        unscheduled.push({
          ProductionOrderOperationId: operation.Id,
          ProductionOrderId: order?.Id ?? operation.ProductionOrderId,
          OrderNo: order?.OrderNo ?? null,
          WorkCenterId: operation.WorkCenterId,
          Reason: "DEPENDENCY_UNRESOLVED",
        });
        processed++;
      }
      break;
    }

    const operation = ready[0];
    const order = orderById.get(operation.ProductionOrderId);
    const predecessorId = operation.PredecessorOperationId;
    const predecessorState = predecessorId ? states.get(predecessorId) : null;
    const successorIds = successors.get(operation.Id) ?? [];
    const requiredMinutes = processingMinutes(operation);
    let lowerBound = fromMs;
    let upperBound = toMs;
    if (direction === "forward") {
      const requestedStart = instant(order.RequestedStartAt);
      if (requestedStart !== null) lowerBound = Math.max(lowerBound, requestedStart);
      if (predecessorId && predecessorState?.status === "failed") {
        markFailed(operation, "PREDECESSOR_UNSCHEDULED");
        processed++;
        continue;
      }
      if (predecessorId) {
        const predecessorTime = scheduledTimes.get(predecessorId);
        if (!predecessorTime || !Number.isFinite(predecessorTime.end)) {
          markFailed(operation, "PREDECESSOR_FINISH_MISSING");
          processed++;
          continue;
        }
        lowerBound = Math.max(lowerBound, predecessorTime.end);
      }
      lowerBound += (finiteNumber(operation.PlannedQueueMinutes, 0) + finiteNumber(operation.PlannedMoveMinutes, 0)) * MINUTE_MS;
      const fixedBound = fixedSuccessorUpperBound(operation.Id);
      if (Number.isFinite(fixedBound)) upperBound = Math.min(upperBound, fixedBound);
    } else {
      const dueAt = instant(order.DueAt);
      if (dueAt !== null) upperBound = Math.min(upperBound, dueAt);
      const requestedStart = instant(order.RequestedStartAt);
      if (requestedStart !== null) lowerBound = Math.max(lowerBound, requestedStart);
      const failedSuccessor = successorIds.find((successorId) => states.get(successorId)?.status === "failed");
      if (failedSuccessor) {
        markFailed(operation, "SUCCESSOR_UNSCHEDULED");
        processed++;
        continue;
      }
      for (const successorId of successorIds) {
        const successorTime = scheduledTimes.get(successorId);
        const successor = operationsById.get(successorId);
        if (!successorTime || !Number.isFinite(successorTime.start) || !successor) continue;
        upperBound = Math.min(upperBound, successorTime.start - (finiteNumber(successor.PlannedQueueMinutes, 0) + finiteNumber(successor.PlannedMoveMinutes, 0)) * MINUTE_MS);
      }
      if (predecessorId) {
        const predecessorState = states.get(predecessorId);
        if (predecessorState?.status === "failed") {
          markFailed(operation, "PREDECESSOR_UNSCHEDULED");
          processed++;
          continue;
        }
        const predecessorTime = scheduledTimes.get(predecessorId);
        if (predecessorTime && Number.isFinite(predecessorTime.end)) lowerBound = Math.max(lowerBound, predecessorTime.end);
      }
    }

    if (requiredMinutes <= 0 || !Number.isFinite(requiredMinutes)) {
      markFailed(operation, "ZERO_OR_INVALID_PROCESSING_TIME");
      processed++;
      continue;
    }

    const workCenter = workCenterById.get(operation.WorkCenterId);
    const wcResources = resourcesByCenter.get(operation.WorkCenterId) ?? [];
    const centerIntervals = intervalsByCenter.get(operation.WorkCenterId) ?? [];
    const plannedOperation = { ...operation, _dispatchRule: dispatchRule };
    const candidates = [];
    for (const resource of wcResources) {
      const segments = buildResourcePlan({
        operation: plannedOperation, workCenter, resource, intervals: centerIntervals, reservations, mode: capacityMode,
        direction, lowerBound, upperBound, requiredMinutes,
      });
      if (!segments) continue;
      const start = Date.parse(segments[0].PlannedStartAt);
      const end = Date.parse(segments.at(-1).PlannedEndAt);
      candidates.push({ resource, segments, start, end });
    }
    candidates.sort((left, right) => direction === "forward"
      ? left.start - right.start || left.end - right.end || String(left.resource.ResourceCode ?? "").localeCompare(String(right.resource.ResourceCode ?? ""))
      : right.end - left.end || right.start - left.start || String(left.resource.ResourceCode ?? "").localeCompare(String(right.resource.ResourceCode ?? "")));
    const selected = candidates[0];
    if (!selected) {
      const hasResourceInWindow = wcResources.some((resource) => centerIntervals.some((interval) => resourceActiveOnDate(resource, interval.calendarDate)));
      const reason = centerIntervals.length === 0
        ? "NO_WORKING_CALENDAR"
        : (wcResources.length === 0 || !hasResourceInWindow ? "NO_ACTIVE_RESOURCE" : "CAPACITY_WINDOW_EXCEEDED");
      markFailed(operation, reason);
      processed++;
      continue;
    }

    const segments = selected.segments;
    if (allStoredSegments.length + segments.length > MAX_SCHEDULE_SEGMENTS) {
      invalid("MFG_SCHEDULE_SEGMENT_LIMIT", `هر اجرا حداکثر ${MAX_SCHEDULE_SEGMENTS} قطعهٔ زمان‌بندی را نگه می‌دارد`);
    }
    segments.forEach((segment) => {
      segment.PlantId = plantId;
      segment._orderId = order.Id;
      segment._preserved = false;
      allStoredSegments.push(segment);
      reservations.push({
        operationId: operation.Id,
        workCenterId: segment.WorkCenterId,
        resourceId: segment.ResourceId,
        start: Date.parse(segment.PlannedStartAt),
        end: Date.parse(segment.PlannedEndAt),
        firm: false,
      });
    });
    operationSegments.set(operation.Id, segments);
    scheduledTimes.set(operation.Id, { start: selected.start, end: selected.end, operation });
    assignmentsByOperation.set(operation.Id, assignmentFrom(operation, order, segments, false));
    states.set(operation.Id, { status: "done", planned: true });
    remainingByOrder.set(operation.ProductionOrderId, Math.max(0, (remainingByOrder.get(operation.ProductionOrderId) ?? 0) - requiredMinutes));
    processed++;
  }

  for (const segment of copiedSegments) {
    segment.PlantId = plantId;
    segment._preserved = true;
  }
  for (const [operationId, segments] of operationSegments) {
    if (assignmentsByOperation.has(operationId)) continue;
    const operation = operationById.get(operationId);
    const order = operation && orderById.get(operation.ProductionOrderId);
    if (!operation || !order) continue;
    assignmentsByOperation.set(operationId, assignmentFrom(operation, order, segments, true));
  }

  const scheduleSegments = allStoredSegments.map((segment) => {
    const { _orderId, _preserved, ...row } = segment;
    return {
      ...row,
      PlantId: plantId,
      ScheduleVersion: scheduleVersion,
      SegmentNo: Number(row.SegmentNo) > 0 ? Number(row.SegmentNo) : 1,
    };
  });
  const capacityRows = createCapacityRows({
    workCenters: activeWorkCenters,
    resourcesByCenter,
    intervalsByCenter,
    scheduleSegments,
    downtimeReservations,
    fromMs,
    toMs,
    plantId,
    scheduleVersion,
  });
  const assignments = [...assignmentsByOperation.values()].sort((a, b) =>
    String(a.OrderNo ?? "").localeCompare(String(b.OrderNo ?? ""))
    || Number(a.SequenceNo ?? 0) - Number(b.SequenceNo ?? 0)
    || String(a.ProductionOrderOperationId).localeCompare(String(b.ProductionOrderOperationId)));

  const rescheduledOperationIds = operationsInScope
    .filter((operation) => targetOperationIds.has(operation.Id) && !preservedOperationIds.has(operation.Id))
    .sort((left, right) => {
      const leftOrder = orderById.get(left.ProductionOrderId);
      const rightOrder = orderById.get(right.ProductionOrderId);
      return String(leftOrder?.OrderNo ?? "").localeCompare(String(rightOrder?.OrderNo ?? ""))
        || Number(left.SequenceNo ?? 0) - Number(right.SequenceNo ?? 0)
        || String(left.Id).localeCompare(String(right.Id));
    })
    .map((operation) => operation.Id);

  const diff = diffManufacturingSchedules({
    previousScheduleVersion,
    scheduleVersion,
    operations: operationsInScope,
    orders: activeOrders,
    previousSegments: existingSchedules.filter((segment) => segment.PlantId === plantId && currentOperationIds.has(segment.ProductionOrderOperationId)),
    currentSegments: scheduleSegments,
    requestedOperationIds: hasExplicitOperationSelection ? requestedOperationIdList : [...targetOperationIds],
    rescheduledOperationIds,
    preservedOperationIds,
  });

  return {
    scheduleSegments,
    capacityRows,
    assignments,
    unscheduled,
    rescheduledOperationIds,
    diff,
    summary: {
      scheduledOperationCount: [...assignmentsByOperation.values()].filter((assignment) => assignment.Segments.length > 0).length,
      unscheduledOperationCount: unscheduled.length,
      segmentCount: scheduleSegments.length,
      capacityBucketCount: capacityRows.length,
      overloadBucketCount: capacityRows.filter((row) => row.IsBottleneck).length,
      dispatchRule,
      direction,
      capacityMode,
    },
  };
}
