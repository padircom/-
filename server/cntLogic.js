// src/services/contracts.ts
var CNT_VERSION = "cnt-v1";
var CNT_DOMAIN_ID = "d14";
function round(n, digits = 2) {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function validateBoqItem(item) {
  const issues = [];
  const at = item.ItemNo;
  if (item.PricingBasis === "unit_price") {
    if (!item.Unit) {
      issues.push({ code: "CNT-BOQ-UNIT", field: "Unit", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0648\u0627\u062D\u062F \u0633\u0646\u062C\u0634 \u0628\u0631\u0627\u06CC \u0631\u062F\u06CC\u0641 \u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627\u06CC\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A` });
    }
    if (item.ContractQty === null || item.ContractQty === void 0) {
      issues.push({ code: "CNT-BOQ-QTY", field: "ContractQty", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0645\u0642\u062F\u0627\u0631 \u067E\u06CC\u0645\u0627\u0646\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A` });
    } else if (num(item.ContractQty) < 0) {
      issues.push({ code: "CNT-BOQ-QTY-NEG", field: "ContractQty", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0645\u0642\u062F\u0627\u0631 \u067E\u06CC\u0645\u0627\u0646\u06CC \u0645\u0646\u0641\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A` });
    }
    if (item.UnitRate === null || item.UnitRate === void 0) {
      issues.push({ code: "CNT-BOQ-RATE", field: "UnitRate", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0642\u06CC\u0645\u062A \u0648\u0627\u062D\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A` });
    } else if (num(item.UnitRate) < 0) {
      issues.push({ code: "CNT-BOQ-RATE-NEG", field: "UnitRate", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0642\u06CC\u0645\u062A \u0648\u0627\u062D\u062F \u0645\u0646\u0641\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A` });
    }
    if (item.LumpSumAmount !== null && item.LumpSumAmount !== void 0) {
      issues.push({ code: "CNT-BOQ-MIXED", field: "LumpSumAmount", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0631\u062F\u06CC\u0641 \u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627\u06CC\u06CC \u0646\u0628\u0627\u06CC\u062F \u0645\u0628\u0644\u063A \u0645\u0642\u0637\u0648\u0639 \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F` });
    }
    const expected = round(num(item.ContractQty) * num(item.UnitRate), 2);
    if (item.ContractQty != null && item.UnitRate != null && Math.abs(expected - num(item.LineAmount)) > 0.5) {
      issues.push({
        code: "CNT-BOQ-AMOUNT",
        field: "LineAmount",
        itemNo: at,
        severity: "error",
        messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0645\u0628\u0644\u063A \u0631\u062F\u06CC\u0641 ${num(item.LineAmount).toLocaleString("fa-IR")} \u0628\u0627 \u062D\u0627\u0635\u0644\u200C\u0636\u0631\u0628 \u0645\u0642\u062F\u0627\u0631 \u062F\u0631 \u0646\u0631\u062E (${expected.toLocaleString("fa-IR")}) \u0646\u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F`
      });
    }
  } else if (item.PricingBasis === "lump_sum") {
    if (item.LumpSumAmount === null || item.LumpSumAmount === void 0) {
      issues.push({ code: "CNT-BOQ-LS-AMOUNT", field: "LumpSumAmount", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0645\u0628\u0644\u063A \u0645\u0642\u0637\u0648\u0639 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A` });
    } else if (num(item.LumpSumAmount) < 0) {
      issues.push({ code: "CNT-BOQ-LS-NEG", field: "LumpSumAmount", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0645\u0628\u0644\u063A \u0645\u0642\u0637\u0648\u0639 \u0645\u0646\u0641\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A` });
    }
    if (item.ContractQty != null || item.UnitRate != null) {
      issues.push({
        code: "CNT-BOQ-LS-MIXED",
        itemNo: at,
        severity: "error",
        messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0631\u062F\u06CC\u0641 \u0645\u0642\u0637\u0648\u0639 \u0646\u0628\u0627\u06CC\u062F \u0645\u0642\u062F\u0627\u0631 \u06CC\u0627 \u0642\u06CC\u0645\u062A \u0648\u0627\u062D\u062F \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F\u061B \u0627\u06AF\u0631 \u0645\u0642\u062F\u0627\u0631 \u062F\u0627\u0631\u062F \u062D\u0627\u0644\u062A \u0622\u0646 \u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627\u06CC\u06CC \u0627\u0633\u062A`
      });
    }
    if (item.LumpSumAmount != null && Math.abs(num(item.LumpSumAmount) - num(item.LineAmount)) > 0.5) {
      issues.push({ code: "CNT-BOQ-LS-AMOUNT-MISMATCH", field: "LineAmount", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u0645\u0628\u0644\u063A \u0631\u062F\u06CC\u0641 \u0628\u0627 \u0645\u0628\u0644\u063A \u0645\u0642\u0637\u0648\u0639 \u06CC\u06A9\u06CC \u0646\u06CC\u0633\u062A` });
    }
  } else {
    issues.push({ code: "CNT-BOQ-BASIS", field: "PricingBasis", itemNo: at, severity: "error", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u062D\u0627\u0644\u062A \u0627\u0631\u0632\u0634\u200C\u06AF\u0630\u0627\u0631\u06CC \u0628\u0627\u06CC\u062F unit_price \u06CC\u0627 lump_sum \u0628\u0627\u0634\u062F` });
  }
  if (item.IsStarred && item.RateStatus === "agreed" && !num(item.LineAmount)) {
    issues.push({ code: "CNT-BOQ-STAR-RATE", itemNo: at, severity: "warning", messageFa: `\u0631\u062F\u06CC\u0641 ${at}: \u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F \u0628\u0627 \u0646\u0631\u062E \u062A\u0648\u0627\u0641\u0642\u200C\u0634\u062F\u0647 \u0648\u0644\u06CC \u0645\u0628\u0644\u063A \u0635\u0641\u0631` });
  }
  return issues;
}
function validateBoq(items) {
  const issues = [];
  for (const it of items) issues.push(...validateBoqItem(it));
  const seen = /* @__PURE__ */ new Set();
  for (const it of items) {
    if (seen.has(it.ItemNo)) {
      issues.push({ code: "CNT-BOQ-DUP", itemNo: it.ItemNo, severity: "error", messageFa: `\u0634\u0645\u0627\u0631\u0647\u0654 \u0631\u062F\u06CC\u0641 ${it.ItemNo} \u062A\u06A9\u0631\u0627\u0631\u06CC \u0627\u0633\u062A` });
    }
    seen.add(it.ItemNo);
  }
  for (const it of items) {
    if (it.ParentItemNo && !seen.has(it.ParentItemNo)) {
      issues.push({ code: "CNT-BOQ-ORPHAN", itemNo: it.ItemNo, severity: "warning", messageFa: `\u0631\u062F\u06CC\u0641 ${it.ItemNo}: \u0631\u062F\u06CC\u0641 \u0648\u0627\u0644\u062F ${it.ParentItemNo} \u062F\u0631 \u0641\u0647\u0631\u0633\u062A \u0646\u06CC\u0633\u062A` });
    }
  }
  const active = items.filter((i) => (i.Status ?? "active") === "active");
  const byBasis = {
    unit_price: round(active.filter((i) => i.PricingBasis === "unit_price").reduce((s, i) => s + num(i.LineAmount), 0), 2),
    lump_sum: round(active.filter((i) => i.PricingBasis === "lump_sum").reduce((s, i) => s + num(i.LineAmount), 0), 2)
  };
  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    totalAmount: round(byBasis.unit_price + byBasis.lump_sum, 2),
    byBasis
  };
}
function lineAmount(item) {
  return item.PricingBasis === "lump_sum" ? round(num(item.LumpSumAmount), 2) : round(num(item.ContractQty) * num(item.UnitRate), 2);
}
function boqRollup(items) {
  const active = items.filter((i) => (i.Status ?? "active") === "active");
  const total = round(active.reduce((s, i) => s + num(i.LineAmount), 0), 2);
  const map = /* @__PURE__ */ new Map();
  for (const it of active) {
    const key = it.ChapterCode ?? "\u0628\u062F\u0648\u0646 \u0641\u0635\u0644";
    const cur = map.get(key) ?? { chapterCode: key, itemCount: 0, amount: 0, sharePct: 0, byBasis: { unit_price: 0, lump_sum: 0 } };
    cur.itemCount += 1;
    cur.amount = round(cur.amount + num(it.LineAmount), 2);
    cur.byBasis[it.PricingBasis] = round(cur.byBasis[it.PricingBasis] + num(it.LineAmount), 2);
    map.set(key, cur);
  }
  const chapters = [...map.values()].map((c) => ({ ...c, sharePct: total > 0 ? round(c.amount / total * 100, 2) : 0 })).sort((a, b) => b.amount - a.amount);
  return { chapters, total };
}
function measurementQuantity(row) {
  const parts = [row.Count, row.Length, row.Width, row.Height, row.Factor].filter((v) => v !== null && v !== void 0 && v !== "").map((v) => num(v));
  if (parts.length === 0) return 0;
  return round(parts.reduce((a, b) => a * b, 1), 3);
}
function measurementTotal(rows) {
  let total = 0;
  const mismatches = [];
  for (const r of rows) {
    const computed = measurementQuantity(r);
    const stored = r.Quantity === null || r.Quantity === void 0 ? computed : num(r.Quantity);
    if (Math.abs(stored - computed) > 1e-3) {
      mismatches.push({ sheetNo: r.SheetNo, stored, computed });
    }
    total += stored;
  }
  return { total: round(total, 3), rowCount: rows.length, mismatches };
}
function lineEarnedValue(input) {
  const basis = input.item.PricingBasis;
  if (basis === "lump_sum") {
    const amount = num(input.item.LumpSumAmount) || num(input.item.LineAmount);
    const prevPct = num(input.prevPct);
    const cumPct = num(input.cumPct);
    const currentPct = round(cumPct - prevPct, 4);
    return {
      basis,
      currentQty: null,
      currentPct,
      earnedPrevious: round(prevPct / 100 * amount, 2),
      earnedCurrent: round(currentPct / 100 * amount, 2),
      earnedCumulative: round(cumPct / 100 * amount, 2)
    };
  }
  const rate = num(input.item.UnitRate);
  const prevQty = num(input.prevQty);
  const cumQty = num(input.cumQty);
  const currentQty = round(cumQty - prevQty, 3);
  return {
    basis,
    currentQty,
    currentPct: null,
    earnedPrevious: round(prevQty * rate, 2),
    earnedCurrent: round(currentQty * rate, 2),
    earnedCumulative: round(cumQty * rate, 2)
  };
}
function milestoneProgress(milestones) {
  const weightSum = round(milestones.reduce((s, m) => s + num(m.WeightPct), 0), 4);
  const verified = milestones.filter((m) => m.Status === "verified");
  const cumPct = round(
    verified.reduce((s, m) => s + (num(m.AchievedPct) || num(m.WeightPct)), 0),
    4
  );
  return {
    cumPct: Math.min(cumPct, 100),
    verifiedCount: verified.length,
    claimedCount: milestones.filter((m) => m.Status === "claimed").length,
    weightSum,
    weightIssueFa: Math.abs(weightSum - 100) > 0.01 ? `\u062C\u0645\u0639 \u0648\u0632\u0646 \u0645\u0631\u0627\u062D\u0644 ${weightSum} \u0627\u0633\u062A\u060C \u0646\u0647 \u06F1\u06F0\u06F0` : null
  };
}
function contractCeiling(input) {
  const initialAmount = round(num(input.initialAmount), 2);
  const ceilingPct = input.ceilingPct ?? 25;
  const ceilingAmount = round(initialAmount * (1 + ceilingPct / 100), 2);
  const executedAmount = round(num(input.executedAmount), 2);
  const usedPct = initialAmount > 0 ? round(executedAmount / initialAmount * 100, 2) : 0;
  const remainingAmount = round(ceilingAmount - executedAmount, 2);
  const warnAt = input.warnAtPct ?? 100 + ceilingPct * 0.8;
  const status = executedAmount > ceilingAmount ? "exceeded" : usedPct >= warnAt ? "warning" : "ok";
  const messageFa = status === "exceeded" ? `\u06A9\u0627\u0631\u06A9\u0631\u062F ${usedPct}\u066A \u0645\u0628\u0644\u063A \u0627\u0648\u0644\u06CC\u0647 \u0627\u0633\u062A \u0648 \u0627\u0632 \u0633\u0642\u0641 ${100 + ceilingPct}\u066A \u06AF\u0630\u0634\u062A\u0647\u061B \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0627\u0644\u062D\u0627\u0642\u06CC\u0647 \u06CC\u0627 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u063A\u06CC\u06CC\u0631 \u0645\u0635\u0648\u0628` : status === "warning" ? `\u06A9\u0627\u0631\u06A9\u0631\u062F ${usedPct}\u066A \u0645\u0628\u0644\u063A \u0627\u0648\u0644\u06CC\u0647 \u0627\u0633\u062A\u061B \u062A\u0627 \u0633\u0642\u0641 ${100 + ceilingPct}\u066A \u0641\u0627\u0635\u0644\u0647\u0654 \u06A9\u0645\u06CC \u0645\u0627\u0646\u062F\u0647` : `\u06A9\u0627\u0631\u06A9\u0631\u062F ${usedPct}\u066A \u0645\u0628\u0644\u063A \u0627\u0648\u0644\u06CC\u0647 \u0627\u0633\u062A\u061B \u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0645\u062C\u0627\u0632`;
  return { initialAmount, ceilingPct, ceilingAmount, executedAmount, usedPct, remainingAmount, status, messageFa };
}
function extraWorkBillable(item) {
  if (item.Status === "rejected") return { billable: false, reasonFa: "\u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F \u0631\u062F \u0634\u062F\u0647 \u0627\u0633\u062A" };
  if (item.RateStatus === "rate_pending" || item.Status === "rate_pending") {
    return { billable: false, reasonFa: "\u0646\u0631\u062E \u0647\u0646\u0648\u0632 \u062A\u0635\u0648\u06CC\u0628 \u0646\u0634\u062F\u0647\u061B \u0645\u0642\u062F\u0627\u0631 \u062B\u0628\u062A \u0645\u06CC\u200C\u0634\u0648\u062F \u0648\u0644\u06CC \u062F\u0631 \u062C\u0645\u0639 \u0645\u0627\u0644\u06CC \u0646\u0645\u06CC\u200C\u0622\u06CC\u062F" };
  }
  if (item.RateStatus === "disputed") return { billable: false, reasonFa: "\u0646\u0631\u062E \u0645\u0648\u0631\u062F \u0627\u062E\u062A\u0644\u0627\u0641 \u0627\u0633\u062A" };
  if (!num(item.AgreedRate)) return { billable: false, reasonFa: "\u0646\u0631\u062E \u062A\u0648\u0627\u0641\u0642\u200C\u0634\u062F\u0647 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A" };
  return { billable: true, reasonFa: "\u0642\u0627\u0628\u0644 \u062F\u0631\u062C \u062F\u0631 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A" };
}
function qualityGate(input) {
  const accepted = input.inspections.filter(
    (i) => String(i.Outcome ?? "").toLowerCase() === "accepted" || String(i.Outcome ?? "") === "pass"
  );
  const hasIr = input.inspectionRecordCode ? accepted.some((i) => i.Code === input.inspectionRecordCode) : input.activityId ? accepted.some((i) => i.ActivityId === input.activityId) : false;
  const hasOpenNcr = !!input.activityId && (input.openNcrActivityIds ?? []).includes(input.activityId);
  if (hasIr && !hasOpenNcr) {
    return { status: "passed", passed: true, code: null, messageFa: "\u062A\u0623\u06CC\u06CC\u062F\u06CC\u0647\u0654 \u0628\u0627\u0632\u0631\u0633\u06CC \u0645\u0648\u062C\u0648\u062F \u0648 \u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642 \u0628\u0627\u0632 \u0646\u062F\u0627\u0631\u062F" };
  }
  if (input.override && input.override.by) {
    return {
      status: "overridden",
      passed: true,
      code: "CNT-GATE-OVERRIDE",
      messageFa: `\u062F\u0631\u0648\u0627\u0632\u0647\u0654 \u06A9\u06CC\u0641\u06CC \u0628\u0627 \u0645\u062C\u0648\u0632 ${input.override.by} \u062F\u0648\u0631 \u0632\u062F\u0647 \u0634\u062F: ${input.override.reasonFa}`
    };
  }
  if (hasOpenNcr) {
    return { status: "open_ncr", passed: false, code: "E-CNT-OPEN-NCR", messageFa: "\u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642 \u0628\u0627\u0632 \u0631\u0648\u06CC \u0627\u06CC\u0646 \u0641\u0639\u0627\u0644\u06CC\u062A \u062B\u0628\u062A \u0627\u0633\u062A" };
  }
  return { status: "no_ir", passed: false, code: "E-CNT-NO-IR", messageFa: "\u062A\u0623\u06CC\u06CC\u062F\u06CC\u0647\u0654 \u0628\u0627\u0632\u0631\u0633\u06CC \u067E\u0630\u06CC\u0631\u0641\u062A\u0647\u200C\u0634\u062F\u0647 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u06A9\u0627\u0631\u06A9\u0631\u062F \u06CC\u0627\u0641\u062A \u0646\u0634\u062F" };
}
function mappingCoverage(items) {
  const active = items.filter((i) => (i.Status ?? "active") === "active");
  const unmappedWbs = active.filter((i) => !i.WbsId).map((i) => i.ItemNo);
  const unmappedCbs = active.filter((i) => !i.CostAccountCode).map((i) => i.ItemNo);
  const total = active.length;
  const wbsMapped = total - unmappedWbs.length;
  const cbsMapped = total - unmappedCbs.length;
  return {
    total,
    wbsMapped,
    cbsMapped,
    wbsCoveragePct: total > 0 ? round(wbsMapped / total * 100, 2) : 0,
    cbsCoveragePct: total > 0 ? round(cbsMapped / total * 100, 2) : 0,
    unmappedWbs: unmappedWbs.slice(0, 50),
    unmappedCbs: unmappedCbs.slice(0, 50),
    /* ردیف بدون نگاشت WBS در مقایسهٔ پیشرفت فیزیکی و مالی نامرئی می‌ماند —
     * همان تلهٔ «فعالیت بدون WbsId هرگز قفل نمی‌گیرد» در ماژول مهندسی. */
    noteFa: unmappedWbs.length ? `${unmappedWbs.length} \u0631\u062F\u06CC\u0641 \u0628\u062F\u0648\u0646 \u0646\u06AF\u0627\u0634\u062A WBS \u062F\u0631 \u0645\u0642\u0627\u06CC\u0633\u0647\u0654 \u067E\u06CC\u0634\u0631\u0641\u062A \u0641\u06CC\u0632\u06CC\u06A9\u06CC \u0648 \u0645\u0627\u0644\u06CC \u062F\u06CC\u062F\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F` : "\u0647\u0645\u0647\u0654 \u0631\u062F\u06CC\u0641\u200C\u0647\u0627 \u0628\u0647 \u0633\u0627\u062E\u062A\u0627\u0631 \u0634\u06A9\u0633\u062A \u06A9\u0627\u0631 \u0646\u06AF\u0627\u0634\u062A \u0634\u062F\u0647\u200C\u0627\u0646\u062F"
  };
}
function contractSummary(input) {
  const { contract, items } = input;
  const roll = boqRollup(items);
  const validation = validateBoq(items);
  const amendmentDelta = round(
    (input.amendments ?? []).filter((a) => a.Status === "approved").reduce((s, a) => s + num(a.AmountDelta), 0),
    2
  );
  const expectedCurrent = round(num(contract.InitialAmount) + amendmentDelta, 2);
  const boqVariance = round(roll.total - expectedCurrent, 2);
  return {
    contractId: contract.Id,
    code: contract.Code,
    titleFa: contract.TitleFa,
    contractType: contract.ContractType,
    initialAmount: round(num(contract.InitialAmount), 2),
    currentAmount: round(num(contract.CurrentAmount), 2),
    amendmentDelta,
    boqTotal: roll.total,
    boqVarianceFa: Math.abs(boqVariance) > 1 ? `\u062C\u0645\u0639 \u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627 ${roll.total.toLocaleString("fa-IR")} \u0628\u0627 \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0628\u0647\u200C\u0639\u0644\u0627\u0648\u0647\u0654 \u0627\u0644\u062D\u0627\u0642\u06CC\u0647\u200C\u0647\u0627 (${expectedCurrent.toLocaleString("fa-IR")}) ${Math.abs(boqVariance).toLocaleString("fa-IR")} \u0631\u06CC\u0627\u0644 \u0627\u062E\u062A\u0644\u0627\u0641 \u062F\u0627\u0631\u062F` : null,
    chapters: roll.chapters,
    ceiling: contractCeiling({
      initialAmount: num(contract.InitialAmount),
      executedAmount: input.executedAmount ?? 0,
      ceilingPct: contract.CeilingPct ?? 25
    }),
    mapping: mappingCoverage(items),
    validation: {
      ok: validation.ok,
      errorCount: validation.issues.filter((i) => i.severity === "error").length,
      warningCount: validation.issues.filter((i) => i.severity === "warning").length
    }
  };
}
var PRICING_BASIS_FA = {
  unit_price: "\u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627\u06CC\u06CC",
  lump_sum: "\u0645\u0642\u0637\u0648\u0639"
};
var CONTRACT_TYPE_FA = {
  unit_price: "\u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627\u06CC\u06CC",
  lump_sum: "\u0645\u0642\u0637\u0648\u0639",
  mixed: "\u062A\u0631\u06A9\u06CC\u0628\u06CC",
  cost_plus: "\u0627\u0645\u0627\u0646\u06CC"
};
var RATE_STATUS_FA = {
  agreed: "\u062A\u0648\u0627\u0641\u0642\u200C\u0634\u062F\u0647",
  rate_pending: "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0646\u0631\u062E",
  disputed: "\u0645\u0648\u0631\u062F \u0627\u062E\u062A\u0644\u0627\u0641"
};
var IPC_WORKFLOW_FA = {
  draft: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633",
  contractor_submitted: "\u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631",
  consultant_review: "\u0628\u0631\u0631\u0633\u06CC \u0645\u0634\u0627\u0648\u0631",
  consultant_approved: "\u062A\u0623\u06CC\u06CC\u062F \u0645\u0634\u0627\u0648\u0631",
  employer_review: "\u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0641\u0631\u0645\u0627",
  approved: "\u0645\u0635\u0648\u0628",
  rejected: "\u0631\u062F \u0634\u062F\u0647",
  paid: "\u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0634\u062F\u0647"
};
var GUARANTEE_TYPE_FA = {
  advance: "\u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A",
  performance: "\u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u062A\u0639\u0647\u062F\u0627\u062A",
  bid: "\u0634\u0631\u06A9\u062A \u062F\u0631 \u0645\u0646\u0627\u0642\u0635\u0647",
  retention: "\u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u06A9\u0627\u0631",
  warranty: "\u062F\u0648\u0631\u0647\u0654 \u062A\u0636\u0645\u06CC\u0646"
};
var IPC_TRANSITIONS = [
  { from: "draft", action: "submit", actor: "contractor", to: "contractor_submitted" },
  { from: "contractor_submitted", action: "approve", actor: "consultant", to: "consultant_approved" },
  { from: "contractor_submitted", action: "reject", actor: "consultant", to: "rejected" },
  { from: "contractor_submitted", action: "return_for_correction", actor: "consultant", to: "draft" },
  { from: "consultant_approved", action: "approve", actor: "employer", to: "approved" },
  { from: "consultant_approved", action: "reject", actor: "employer", to: "rejected" },
  { from: "consultant_approved", action: "return_for_correction", actor: "employer", to: "draft" },
  { from: "approved", action: "pay", actor: "employer", to: "paid" }
];
function ipcTransition(from, action, actor) {
  const match = IPC_TRANSITIONS.find((t) => t.from === from && t.action === action);
  if (!match) {
    return {
      ok: false,
      from,
      to: null,
      code: "E-CNT-BAD-TRANSITION",
      messageFa: `\u0627\u0642\u062F\u0627\u0645 \xAB${action}\xBB \u0627\u0632 \u0648\u0636\u0639\u06CC\u062A \xAB${IPC_WORKFLOW_FA[from] ?? from}\xBB \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A`
    };
  }
  if (match.actor !== actor) {
    return {
      ok: false,
      from,
      to: null,
      code: "E-CNT-WRONG-ACTOR",
      messageFa: `\u0627\u06CC\u0646 \u0627\u0642\u062F\u0627\u0645 \u062A\u0646\u0647\u0627 \u062F\u0631 \u0627\u062E\u062A\u06CC\u0627\u0631 ${match.actor === "consultant" ? "\u0645\u0634\u0627\u0648\u0631" : match.actor === "employer" ? "\u06A9\u0627\u0631\u0641\u0631\u0645\u0627" : "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631"} \u0627\u0633\u062A`
    };
  }
  return { ok: true, from, to: match.to, code: null, messageFa: "" };
}
function ipcNextActions(from, actor) {
  return IPC_TRANSITIONS.filter((t) => t.from === from && (!actor || t.actor === actor)).map(
    (t) => t.action
  );
}
function isIpcLocked(state) {
  return state === "approved" || state === "paid" || state === "rejected";
}
function computeDeductions(subtotal, cfg) {
  const base = round(num(subtotal), 2);
  const rows = [];
  const pctRow = (type, pct2, statutory, noteFa) => {
    const rate = num(pct2);
    if (rate <= 0) return;
    rows.push({
      DeductionType: type,
      BaseAmount: base,
      RatePct: rate,
      Amount: round(base * rate / 100, 2),
      IsStatutory: statutory,
      NoteFa: noteFa
    });
  };
  const recoveryPct = num(cfg.advanceRecoveryPct);
  if (recoveryPct > 0) {
    const uncapped = round(base * recoveryPct / 100, 2);
    const outstanding = cfg.advanceOutstanding == null ? uncapped : round(num(cfg.advanceOutstanding), 2);
    const amount = Math.max(0, Math.min(uncapped, outstanding));
    if (amount > 0) {
      rows.push({
        DeductionType: "advance_recovery",
        BaseAmount: base,
        RatePct: recoveryPct,
        Amount: amount,
        IsStatutory: false,
        NoteFa: amount < uncapped ? `\u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u062D\u062F\u0648\u062F \u0628\u0647 \u0645\u0627\u0646\u062F\u0647\u0654 ${outstanding.toLocaleString("fa-IR")}` : "\u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A"
      });
    }
  }
  pctRow("retainage", cfg.retainagePct, false, "\u0633\u067E\u0631\u062F\u0647\u0654 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u06A9\u0627\u0631");
  pctRow("insurance", cfg.insurancePct, true, "\u062D\u0642 \u0628\u06CC\u0645\u0647\u0654 \u0633\u0647\u0645 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631");
  pctRow("withholding_tax", cfg.taxPct, true, "\u0645\u0627\u0644\u06CC\u0627\u062A \u062A\u06A9\u0644\u06CC\u0641\u06CC");
  const fixed = (type, amount, noteFa) => {
    const v = round(num(amount), 2);
    if (v <= 0) return;
    rows.push({ DeductionType: type, BaseAmount: base, RatePct: null, Amount: v, IsStatutory: false, NoteFa: noteFa });
  };
  fixed("penalty", cfg.penaltyAmount, "\u062C\u0631\u06CC\u0645\u0647\u0654 \u062A\u0623\u062E\u06CC\u0631");
  fixed("back_to_back", cfg.backToBackAmount, "\u06A9\u0633\u0648\u0631 \u0628\u0627\u0632\u06AF\u0634\u062A\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621");
  fixed("other", cfg.otherAmount, cfg.otherNoteFa || "\u0633\u0627\u06CC\u0631 \u06A9\u0633\u0648\u0631");
  return rows;
}
function computeIpcLines(lines) {
  const out = [];
  let grossCurrent = 0;
  let grossCumulative = 0;
  let excludedCount = 0;
  for (const line of lines) {
    const earned = lineEarnedValue({
      item: {
        PricingBasis: line.PricingBasis,
        UnitRate: line.UnitRate ?? null,
        LumpSumAmount: line.LumpSumAmount ?? null,
        LineAmount: line.LineAmount ?? null
      },
      prevQty: line.prevQty,
      cumQty: line.cumQty,
      prevPct: line.prevPct,
      cumPct: line.cumPct
    });
    const gate = String(line.QualityGateStatus ?? "");
    const rejected = String(line.Status ?? "") === "rejected";
    const gateBlocked = gate === "no_ir" || gate === "open_ncr";
    let excludeReasonFa = null;
    if (rejected) excludeReasonFa = "\u0631\u062F\u06CC\u0641 \u0631\u062F \u0634\u062F\u0647 \u0627\u0633\u062A";
    else if (gateBlocked) {
      excludeReasonFa = gate === "open_ncr" ? "\u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642 \u0628\u0627\u0632 \u062F\u0627\u0631\u062F" : "\u062A\u0623\u06CC\u06CC\u062F\u06CC\u0647\u0654 \u0628\u0627\u0632\u0631\u0633\u06CC \u0646\u062F\u0627\u0631\u062F";
    }
    const included = !excludeReasonFa;
    if (included) {
      grossCurrent = round(grossCurrent + earned.earnedCurrent, 2);
      grossCumulative = round(grossCumulative + earned.earnedCumulative, 2);
    } else {
      excludedCount += 1;
    }
    out.push({ ...earned, BoqItemId: line.BoqItemId, included, excludeReasonFa });
  }
  return { lines: out, grossCurrent, grossCumulative, excludedCount };
}
function computeIpc(input) {
  const agg = computeIpcLines(input.lines ?? []);
  const adjustmentAmount = round(num(input.adjustmentAmount), 2);
  const materialDiffAmount = round(num(input.materialDiffAmount), 2);
  const subtotal = round(agg.grossCurrent + adjustmentAmount + materialDiffAmount, 2);
  const cfg = input.deductions ?? {};
  const deductions = computeDeductions(subtotal, cfg);
  const totalDeductions = round(
    deductions.reduce((s, d) => s + d.Amount, 0),
    2
  );
  const vatPct = num(cfg.vatPct);
  const vatAmount = vatPct > 0 ? round(subtotal * vatPct / 100, 2) : 0;
  return {
    lines: agg.lines,
    grossCurrent: agg.grossCurrent,
    grossCumulative: agg.grossCumulative,
    excludedCount: agg.excludedCount,
    adjustmentAmount,
    materialDiffAmount,
    subtotal,
    deductions,
    totalDeductions,
    vatAmount,
    netPayable: round(subtotal - totalDeductions + vatAmount, 2)
  };
}
function nextIpcSerial(existing) {
  const max = (existing ?? []).reduce((m, r) => Math.max(m, num(r.SerialNo)), 0);
  return max + 1;
}
var DEDUCTION_TYPE_FA = {
  insurance: "\u0628\u06CC\u0645\u0647",
  withholding_tax: "\u0645\u0627\u0644\u06CC\u0627\u062A \u062A\u06A9\u0644\u06CC\u0641\u06CC",
  retainage: "\u0633\u067E\u0631\u062F\u0647\u0654 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u06A9\u0627\u0631",
  advance_recovery: "\u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A",
  penalty: "\u062C\u0631\u06CC\u0645\u0647",
  back_to_back: "\u06A9\u0633\u0648\u0631 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621",
  other: "\u0633\u0627\u06CC\u0631"
};
function priceAdjustment(input) {
  const workAmount = round(num(input.workAmount), 2);
  const baseIndex = num(input.baseIndex);
  const periodIndex = num(input.periodIndex);
  const appliedRatePct = input.appliedRatePct == null ? 100 : num(input.appliedRatePct);
  const adjustmentFactor = baseIndex > 0 ? round(periodIndex / baseIndex, 6) : 1;
  const adjustmentAmount = round(workAmount * (adjustmentFactor - 1) * appliedRatePct / 100, 2);
  const direction = adjustmentFactor > 1 ? "up" : adjustmentFactor < 1 ? "down" : "flat";
  const calcNoteFa = baseIndex > 0 ? `\u0641\u0635\u0644 ${input.chapterCode}: \u0636\u0631\u06CC\u0628 ${adjustmentFactor} = ${periodIndex} \xF7 ${baseIndex}` + (appliedRatePct !== 100 ? ` \u0628\u0627 \u0636\u0631\u06CC\u0628 \u0627\u0639\u0645\u0627\u0644 ${appliedRatePct}\u066A` : "") : `\u0641\u0635\u0644 ${input.chapterCode}: \u0634\u0627\u062E\u0635 \u0645\u0628\u0646\u0627 \u062B\u0628\u062A \u0646\u0634\u062F\u0647\u061B \u062A\u0639\u062F\u06CC\u0644 \u0635\u0641\u0631 \u0645\u0646\u0638\u0648\u0631 \u0634\u062F`;
  return {
    chapterCode: input.chapterCode,
    workAmount,
    baseIndex,
    periodIndex,
    adjustmentFactor,
    adjustmentAmount,
    appliedRatePct,
    direction,
    calcNoteFa
  };
}
function findIndex(catalog, indexPeriod, chapterCode) {
  const rows = (catalog ?? []).filter(
    (r) => r.IndexPeriod === indexPeriod && r.ChapterCode === chapterCode
  );
  if (!rows.length) {
    return {
      found: false,
      index: null,
      usable: false,
      code: "E-CNT-NO-INDEX",
      messageFa: `\u0634\u0627\u062E\u0635 \u0641\u0635\u0644 ${chapterCode} \u0628\u0631\u0627\u06CC \u062F\u0648\u0631\u0647\u0654 ${indexPeriod} \u062F\u0631 \u06A9\u0627\u062A\u0627\u0644\u0648\u06AF \u0646\u06CC\u0633\u062A`
    };
  }
  const published = rows.find((r) => String(r.Status ?? "") === "published");
  if (published) {
    return { found: true, index: published, usable: true, code: null, messageFa: "" };
  }
  const draft = rows[0];
  return {
    found: true,
    index: draft,
    usable: false,
    code: "E-CNT-INDEX-NOT-PUBLISHED",
    messageFa: `\u0634\u0627\u062E\u0635 \u0641\u0635\u0644 ${chapterCode} \u062F\u0648\u0631\u0647\u0654 ${indexPeriod} \u0648\u0636\u0639\u06CC\u062A \xAB${draft.Status}\xBB \u062F\u0627\u0631\u062F \u0648 \u0645\u0628\u0646\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u0645\u0635\u0648\u0628 \u0646\u06CC\u0633\u062A`
  };
}
function adjustmentBatch(input) {
  const rows = [];
  const blocked = [];
  let totalWork = 0;
  for (const ch of input.chapters ?? []) {
    totalWork = round(totalWork + num(ch.workAmount), 2);
    const period = findIndex(input.catalog, input.indexPeriod, ch.chapterCode);
    const base = findIndex(input.catalog, input.baseIndexPeriod, ch.chapterCode);
    if (!period.usable || !base.usable) {
      const bad = !base.usable ? base : period;
      blocked.push({
        chapterCode: ch.chapterCode,
        code: bad.code ?? "E-CNT-NO-INDEX",
        messageFa: bad.messageFa
      });
      continue;
    }
    rows.push(
      priceAdjustment({
        chapterCode: ch.chapterCode,
        workAmount: ch.workAmount,
        baseIndex: num(base.index?.IndexValue),
        periodIndex: num(period.index?.IndexValue),
        appliedRatePct: input.appliedRatePct
      })
    );
  }
  const totalAdjustment = round(
    rows.reduce((s, r) => s + r.adjustmentAmount, 0),
    2
  );
  return {
    rows,
    blocked,
    totalAdjustment,
    totalWork,
    effectivePct: totalWork > 0 ? round(totalAdjustment / totalWork * 100, 2) : 0,
    usable: blocked.length === 0 && rows.length > 0
  };
}
function cumulativeAdjustment(periods) {
  let total = 0;
  let approvedTotal = 0;
  for (const p of periods ?? []) {
    const v = num(p.AdjustmentAmount);
    total = round(total + v, 2);
    if (String(p.Status ?? "") === "approved") approvedTotal = round(approvedTotal + v, 2);
  }
  return { total, approvedTotal, pendingTotal: round(total - approvedTotal, 2) };
}
function materialDiff(input) {
  const quantity = num(input.quantity);
  const baseRate = num(input.baseRate);
  const periodRate = num(input.periodRate);
  const rateDelta = round(periodRate - baseRate, 2);
  return {
    ...input,
    quantity,
    baseRate,
    periodRate,
    rateDelta,
    diffAmount: round(quantity * rateDelta, 2),
    direction: rateDelta > 0 ? "up" : rateDelta < 0 ? "down" : "flat"
  };
}
var INDEX_STATUS_FA = {
  draft: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633",
  published: "\u0645\u0646\u062A\u0634\u0631\u0634\u062F\u0647",
  superseded: "\u0628\u0627\u0632\u0646\u06AF\u0631\u06CC\u200C\u0634\u062F\u0647"
};
function punchSummary(items) {
  const list = items ?? [];
  const openByCategory = {};
  const blockingItems = [];
  let open = 0;
  let closed = 0;
  let waived = 0;
  for (const it of list) {
    const status = String(it.Status ?? "open");
    const cat = String(it.Category ?? "c").toLowerCase();
    if (status === "closed") {
      closed += 1;
      continue;
    }
    if (status === "waived") {
      waived += 1;
      continue;
    }
    open += 1;
    openByCategory[cat] = (openByCategory[cat] ?? 0) + 1;
    if (cat === "a") blockingItems.push(String(it.ItemNo ?? it.TitleFa ?? "\u0628\u062F\u0648\u0646 \u0634\u0645\u0627\u0631\u0647"));
  }
  return {
    total: list.length,
    open,
    closed,
    waived,
    openByCategory,
    blockingCount: blockingItems.length,
    blockingItems
  };
}
function certificateGate(input) {
  const punch = punchSummary(input.punchItems ?? []);
  if (input.type === "pac") {
    if (punch.blockingCount > 0) {
      return {
        ok: false,
        code: "E-CNT-PUNCH-BLOCKING",
        messageFa: `${punch.blockingCount} \u0646\u0642\u0635 \u062F\u0633\u062A\u0647\u0654 \u0627\u0644\u0641 \u0628\u0627\u0632 \u0627\u0633\u062A \u0648 \u0645\u0627\u0646\u0639 \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A \u0645\u06CC\u200C\u0634\u0648\u062F: ${punch.blockingItems.slice(0, 5).join("\u060C ")}`,
        punch
      };
    }
    return { ok: true, code: null, messageFa: "\u0634\u0631\u0627\u06CC\u0637 \u0635\u062F\u0648\u0631 \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A \u0641\u0631\u0627\u0647\u0645 \u0627\u0633\u062A", punch };
  }
  if (!input.hasPac) {
    return {
      ok: false,
      code: "E-CNT-NO-PAC",
      messageFa: "\u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC \u0628\u062F\u0648\u0646 \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A \u067E\u06CC\u0634\u06CC\u0646 \u0635\u0627\u062F\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F",
      punch
    };
  }
  if (punch.open > 0) {
    return {
      ok: false,
      code: "E-CNT-PUNCH-OPEN",
      messageFa: `${punch.open} \u0646\u0642\u0635 \u0628\u0627\u0632 \u0645\u0627\u0646\u062F\u0647 \u0648 \u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC \u0635\u0627\u062F\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F`,
      punch
    };
  }
  if (input.warrantyEnded === false) {
    return {
      ok: false,
      code: "E-CNT-WARRANTY-ACTIVE",
      messageFa: "\u062F\u0648\u0631\u0647\u0654 \u062A\u0636\u0645\u06CC\u0646 \u0647\u0646\u0648\u0632 \u0628\u0647 \u067E\u0627\u06CC\u0627\u0646 \u0646\u0631\u0633\u06CC\u062F\u0647 \u0627\u0633\u062A",
      punch
    };
  }
  return { ok: true, code: null, messageFa: "\u0634\u0631\u0627\u06CC\u0637 \u0635\u062F\u0648\u0631 \u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC \u0641\u0631\u0627\u0647\u0645 \u0627\u0633\u062A", punch };
}
function warrantyEnd(handoverDate, warrantyMonths) {
  if (!handoverDate) return null;
  const d = new Date(handoverDate);
  if (Number.isNaN(d.getTime())) return null;
  const months = num(warrantyMonths) || 0;
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out.toISOString().slice(0, 10);
}
var CERTIFICATE_TYPE_FA = {
  pac: "\u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A",
  fac: "\u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC"
};
var PUNCH_CATEGORY_FA = {
  a: "\u0627\u0644\u0641 \u2014 \u0645\u0627\u0646\u0639 \u062A\u062D\u0648\u06CC\u0644",
  b: "\u0628 \u2014 \u0631\u0641\u0639 \u062F\u0631 \u062F\u0648\u0631\u0647\u0654 \u062A\u0636\u0645\u06CC\u0646",
  c: "\u062C \u2014 \u062C\u0632\u0626\u06CC"
};
function retainageBalance(entries) {
  let accrued = 0;
  let released = 0;
  let forfeited = 0;
  let adjusted = 0;
  let pacReleased = false;
  let facReleased = false;
  for (const e of entries ?? []) {
    if (String(e.Status ?? "posted") === "reversed") continue;
    const amt = round(num(e.Amount), 2);
    switch (e.EntryType) {
      case "accrual":
        accrued = round(accrued + amt, 2);
        break;
      case "release_pac":
        released = round(released + amt, 2);
        pacReleased = true;
        break;
      case "release_fac":
        released = round(released + amt, 2);
        facReleased = true;
        break;
      case "forfeit":
        forfeited = round(forfeited + amt, 2);
        break;
      case "adjustment":
        adjusted = round(adjusted + amt, 2);
        break;
    }
  }
  return {
    accrued,
    released,
    forfeited,
    adjusted,
    balance: round(accrued - released - forfeited + adjusted, 2),
    pacReleased,
    facReleased
  };
}
function planRetainageRelease(input) {
  const bal = retainageBalance(input.entries ?? []);
  const sharePct = input.pacSharePct == null ? 50 : num(input.pacSharePct);
  if (bal.balance <= 0) {
    return {
      ok: false,
      code: "E-CNT-NO-RETAINAGE",
      messageFa: "\u0645\u0627\u0646\u062F\u0647\u0654 \u0633\u067E\u0631\u062F\u0647\u0654 \u0642\u0627\u0628\u0644 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F",
      entryType: null,
      releaseAmount: 0,
      balanceBefore: bal.balance,
      balanceAfter: bal.balance,
      sharePct
    };
  }
  if (input.event === "pac") {
    if (bal.pacReleased) {
      return {
        ok: false,
        code: "E-CNT-PAC-ALREADY-RELEASED",
        messageFa: "\u0633\u0647\u0645 \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A \u067E\u06CC\u0634\u200C\u062A\u0631 \u0622\u0632\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A",
        entryType: null,
        releaseAmount: 0,
        balanceBefore: bal.balance,
        balanceAfter: bal.balance,
        sharePct
      };
    }
    const target = round(bal.accrued * sharePct / 100, 2);
    const releaseAmount = Math.min(target, bal.balance);
    return {
      ok: true,
      code: null,
      messageFa: `${sharePct}\u066A \u0633\u067E\u0631\u062F\u0647 \u0628\u0627\u0628\u062A \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A \u0622\u0632\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F`,
      entryType: "release_pac",
      releaseAmount,
      balanceBefore: bal.balance,
      balanceAfter: round(bal.balance - releaseAmount, 2),
      sharePct
    };
  }
  if (!bal.pacReleased) {
    return {
      ok: false,
      code: "E-CNT-PAC-NOT-RELEASED",
      messageFa: "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC \u067E\u06CC\u0634 \u0627\u0632 \u0633\u0647\u0645 \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A \u0627\u0646\u062C\u0627\u0645 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F",
      entryType: null,
      releaseAmount: 0,
      balanceBefore: bal.balance,
      balanceAfter: bal.balance,
      sharePct
    };
  }
  if (bal.facReleased) {
    return {
      ok: false,
      code: "E-CNT-FAC-ALREADY-RELEASED",
      messageFa: "\u0633\u0647\u0645 \u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC \u067E\u06CC\u0634\u200C\u062A\u0631 \u0622\u0632\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A",
      entryType: null,
      releaseAmount: 0,
      balanceBefore: bal.balance,
      balanceAfter: bal.balance,
      sharePct
    };
  }
  return {
    ok: true,
    code: null,
    messageFa: "\u0645\u0627\u0646\u062F\u0647\u0654 \u0633\u067E\u0631\u062F\u0647 \u0628\u0627\u0628\u062A \u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC \u0622\u0632\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F",
    entryType: "release_fac",
    releaseAmount: bal.balance,
    balanceBefore: bal.balance,
    balanceAfter: 0,
    sharePct
  };
}
var RETAINAGE_ENTRY_FA = {
  accrual: "\u0627\u0646\u0628\u0627\u0634\u062A",
  release_pac: "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A",
  release_fac: "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC",
  forfeit: "\u0636\u0628\u0637",
  adjustment: "\u0627\u0635\u0644\u0627\u062D"
};
var GUARANTEE_TYPES = [
  "advance",
  "performance",
  "bid",
  "retention",
  "warranty"
];
var GUARANTEE_STATUSES = [
  "active",
  "extended",
  "released",
  "forfeited",
  "expired"
];
var GUARANTEE_STATUS_FA = {
  active: "\u0645\u0639\u062A\u0628\u0631",
  extended: "\u062A\u0645\u062F\u06CC\u062F\u0634\u062F\u0647",
  released: "\u0622\u0632\u0627\u062F\u0634\u062F\u0647",
  forfeited: "\u0636\u0628\u0637\u200C\u0634\u062F\u0647",
  expired: "\u0645\u0646\u0642\u0636\u06CC"
};
var GUARANTEE_ALERT_FA = {
  none: "\u0628\u062F\u0648\u0646 \u0647\u0634\u062F\u0627\u0631",
  d30: "\u06A9\u0645\u062A\u0631 \u0627\u0632 \u0633\u06CC \u0631\u0648\u0632 \u062A\u0627 \u0627\u0646\u0642\u0636\u0627",
  d10: "\u06A9\u0645\u062A\u0631 \u0627\u0632 \u062F\u0647 \u0631\u0648\u0632 \u062A\u0627 \u0627\u0646\u0642\u0636\u0627",
  d3: "\u06A9\u0645\u062A\u0631 \u0627\u0632 \u0633\u0647 \u0631\u0648\u0632 \u062A\u0627 \u0627\u0646\u0642\u0636\u0627",
  overdue: "\u0645\u0646\u0642\u0636\u06CC\u200C\u0634\u062F\u0647"
};
var GUARANTEE_ALERT_DAYS = { d30: 30, d10: 10, d3: 3 };
var GUARANTEE_CUSTOMARY_PCT = {
  advance: 100,
  /* هم‌اندازهٔ خودِ پیش‌پرداخت */
  performance: 5,
  bid: 5,
  retention: 10,
  warranty: 10
};
var dayMs = 864e5;
function daysBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round(Math.floor(b / dayMs) - Math.floor(a / dayMs));
}
function guaranteeEffectiveExpiry(row) {
  const base = row.ExpiryDate ?? null;
  const ext = row.ExtendedToDate ?? null;
  if (!base) return ext;
  if (!ext) return base;
  const b = new Date(base).getTime();
  const e = new Date(ext).getTime();
  if (!Number.isFinite(e)) return base;
  if (!Number.isFinite(b)) return ext;
  return e > b ? ext : base;
}
function guaranteeState(row, now = /* @__PURE__ */ new Date()) {
  const warningsFa = [];
  const stored = String(row.Status ?? "active");
  const effectiveExpiry = guaranteeEffectiveExpiry(row);
  const today = new Date(now).toISOString().slice(0, 10);
  const daysToExpiry = daysBetween(today, effectiveExpiry);
  const terminal = stored === "released" || stored === "forfeited";
  let status = stored;
  let isExpiredSilently = false;
  if (!terminal && daysToExpiry != null && daysToExpiry < 0) {
    isExpiredSilently = stored === "active" || stored === "extended";
    status = "expired";
  }
  let alert = "none";
  if (!terminal && daysToExpiry != null) {
    if (daysToExpiry < 0) alert = "overdue";
    else if (daysToExpiry <= GUARANTEE_ALERT_DAYS.d3) alert = "d3";
    else if (daysToExpiry <= GUARANTEE_ALERT_DAYS.d10) alert = "d10";
    else if (daysToExpiry <= GUARANTEE_ALERT_DAYS.d30) alert = "d30";
  }
  if (!effectiveExpiry) {
    warningsFa.push("\u062A\u0627\u0631\u06CC\u062E \u0627\u0646\u0642\u0636\u0627\u06CC \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0647\u0634\u062F\u0627\u0631 \u0632\u0648\u062F\u0647\u0646\u06AF\u0627\u0645 \u06A9\u0627\u0631 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F");
  }
  if (isExpiredSilently) {
    warningsFa.push("\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0645\u0639\u062A\u0628\u0631 \u062B\u0628\u062A \u0634\u062F\u0647 \u0648\u0644\u06CC \u062A\u0627\u0631\u06CC\u062E\u0634 \u06AF\u0630\u0634\u062A\u0647 \u0627\u0633\u062A");
  }
  if (row.ExtendedToDate && row.ExpiryDate) {
    const b = new Date(row.ExpiryDate).getTime();
    const e = new Date(row.ExtendedToDate).getTime();
    if (Number.isFinite(b) && Number.isFinite(e) && e <= b) {
      warningsFa.push("\u062A\u0627\u0631\u06CC\u062E \u062A\u0645\u062F\u06CC\u062F \u0627\u0632 \u062A\u0627\u0631\u06CC\u062E \u0627\u0646\u0642\u0636\u0627\u06CC \u0627\u0635\u0644\u06CC \u062C\u0644\u0648\u062A\u0631 \u0646\u06CC\u0633\u062A \u0648 \u0627\u062B\u0631\u06CC \u0646\u062F\u0627\u0631\u062F");
    }
  }
  return {
    status,
    statusFa: GUARANTEE_STATUS_FA[status] ?? status,
    effectiveExpiry,
    daysToExpiry,
    alert,
    alertFa: GUARANTEE_ALERT_FA[alert],
    isLive: status === "active" || status === "extended",
    isExpiredSilently,
    warningsFa
  };
}
function validateGuaranteeInput(input) {
  const issues = [];
  const err = (code, messageFa) => issues.push({ code, messageFa, severity: "error" });
  const warn = (code, messageFa) => issues.push({ code, messageFa, severity: "warning" });
  if (!String(input.code ?? "").trim()) {
    err("E-CNT-GRT-CODE", "\u06A9\u062F \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A");
  }
  const type = String(input.guaranteeType ?? "");
  if (!GUARANTEE_TYPES.includes(type)) {
    err("E-CNT-GRT-TYPE", "\u0646\u0648\u0639 \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A");
  }
  if (!String(input.bankName ?? "").trim()) {
    err("E-CNT-GRT-BANK", "\u0646\u0627\u0645 \u0628\u0627\u0646\u06A9 \u0635\u0627\u062F\u0631\u06A9\u0646\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A");
  }
  if (!String(input.guaranteeNo ?? "").trim()) {
    err("E-CNT-GRT-NO", "\u0634\u0645\u0627\u0631\u0647\u0654 \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u0628\u0627\u0646\u06A9\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A");
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    err("E-CNT-GRT-AMOUNT", "\u0645\u0628\u0644\u063A \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  }
  const issue = input.issueDate ? new Date(input.issueDate).getTime() : NaN;
  const expiry = input.expiryDate ? new Date(input.expiryDate).getTime() : NaN;
  if (!Number.isFinite(issue)) {
    err("E-CNT-GRT-ISSUE-DATE", "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0648 \u0628\u0627\u06CC\u062F \u0645\u0639\u062A\u0628\u0631 \u0628\u0627\u0634\u062F");
  }
  if (!Number.isFinite(expiry)) {
    err("E-CNT-GRT-EXPIRY-DATE", "\u062A\u0627\u0631\u06CC\u062E \u0627\u0646\u0642\u0636\u0627 \u0627\u0644\u0632\u0627\u0645\u06CC \u0648 \u0628\u0627\u06CC\u062F \u0645\u0639\u062A\u0628\u0631 \u0628\u0627\u0634\u062F");
  }
  if (Number.isFinite(issue) && Number.isFinite(expiry) && expiry <= issue) {
    err("E-CNT-GRT-DATE-ORDER", "\u062A\u0627\u0631\u06CC\u062E \u0627\u0646\u0642\u0636\u0627 \u0628\u0627\u06CC\u062F \u067E\u0633 \u0627\u0632 \u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631 \u0628\u0627\u0634\u062F");
  }
  const contractAmount = Number(input.contractAmount);
  if (Number.isFinite(amount) && amount > 0 && Number.isFinite(contractAmount) && contractAmount > 0 && GUARANTEE_TYPES.includes(type)) {
    const customary = GUARANTEE_CUSTOMARY_PCT[type];
    if (customary != null && type !== "advance") {
      const pct2 = amount / contractAmount * 100;
      if (pct2 < customary / 2 || pct2 > customary * 2) {
        warn(
          "W-CNT-GRT-PCT",
          `\u0645\u0628\u0644\u063A \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 ${round(pct2)} \u062F\u0631\u0635\u062F \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0627\u0633\u062A\u061B \u0639\u0631\u0641 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0646\u0648\u0639 \u062D\u062F\u0648\u062F ${customary} \u062F\u0631\u0635\u062F \u0627\u0633\u062A`
        );
      }
    }
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
function canActOnGuarantee(input) {
  const { row, action, newExpiry } = input;
  const now = input.now ?? /* @__PURE__ */ new Date();
  const st = guaranteeState(row, now);
  const blockersFa = [];
  const warningsFa = [];
  if (st.status === "released") {
    return {
      ok: false,
      code: "E-CNT-GRT-ALREADY-RELEASED",
      messageFa: "\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u067E\u06CC\u0634\u200C\u062A\u0631 \u0622\u0632\u0627\u062F \u0634\u062F\u0647 \u0627\u0633\u062A",
      blockersFa: ["\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u0622\u0632\u0627\u062F\u0634\u062F\u0647 \u062F\u0648\u0628\u0627\u0631\u0647 \u0642\u0627\u0628\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06CC\u0633\u062A"],
      warningsFa
    };
  }
  if (st.status === "forfeited") {
    return {
      ok: false,
      code: "E-CNT-GRT-ALREADY-FORFEITED",
      messageFa: "\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u067E\u06CC\u0634\u200C\u062A\u0631 \u0636\u0628\u0637 \u0634\u062F\u0647 \u0627\u0633\u062A",
      blockersFa: ["\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u0636\u0628\u0637\u200C\u0634\u062F\u0647 \u062F\u0648\u0628\u0627\u0631\u0647 \u0642\u0627\u0628\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06CC\u0633\u062A"],
      warningsFa
    };
  }
  if (action === "extend") {
    const t = newExpiry ? new Date(newExpiry).getTime() : NaN;
    if (!Number.isFinite(t)) {
      blockersFa.push("\u062A\u0627\u0631\u06CC\u062E \u062A\u0645\u062F\u06CC\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0648 \u0628\u0627\u06CC\u062F \u0645\u0639\u062A\u0628\u0631 \u0628\u0627\u0634\u062F");
    } else {
      const cur = st.effectiveExpiry ? new Date(st.effectiveExpiry).getTime() : NaN;
      if (Number.isFinite(cur) && t <= cur) {
        blockersFa.push("\u062A\u0627\u0631\u06CC\u062E \u062A\u0645\u062F\u06CC\u062F \u0628\u0627\u06CC\u062F \u0627\u0632 \u0627\u0646\u0642\u0636\u0627\u06CC \u0641\u0639\u0644\u06CC \u062C\u0644\u0648\u062A\u0631 \u0628\u0627\u0634\u062F");
      }
      if (t < now.getTime()) {
        blockersFa.push("\u062A\u0645\u062F\u06CC\u062F \u0628\u0647 \u062A\u0627\u0631\u06CC\u062E \u06AF\u0630\u0634\u062A\u0647 \u0645\u0639\u0646\u0627 \u0646\u062F\u0627\u0631\u062F");
      }
    }
    if (st.alert === "overdue") {
      warningsFa.push(
        `\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 ${Math.abs(st.daysToExpiry ?? 0)} \u0631\u0648\u0632 \u0645\u0646\u0642\u0636\u06CC \u0628\u0648\u062F\u0647 \u0627\u0633\u062A\u061B \u0627\u06CC\u0646 \u0641\u0627\u0635\u0644\u0647 \u062F\u0631 \u0633\u0627\u0628\u0642\u0647 \u0645\u06CC\u200C\u0645\u0627\u0646\u062F`
      );
    }
    return {
      ok: blockersFa.length === 0,
      code: blockersFa.length ? "E-CNT-GRT-EXTEND-BLOCKED" : null,
      messageFa: blockersFa.length ? "\u062A\u0645\u062F\u06CC\u062F \u0645\u0645\u06A9\u0646 \u0646\u06CC\u0633\u062A" : "\u062A\u0645\u062F\u06CC\u062F \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u0645\u062C\u0627\u0632 \u0627\u0633\u062A",
      blockersFa,
      warningsFa
    };
  }
  if (action === "release") {
    const outstanding = Number(input.advanceOutstanding);
    if (String(row.GuaranteeType) === "advance" && Number.isFinite(outstanding) && outstanding > 0) {
      blockersFa.push(
        `\u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0647\u0646\u0648\u0632 ${round(outstanding)} \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u200C\u0646\u0634\u062F\u0647 \u062F\u0627\u0631\u062F\u061B \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0645\u06A9\u0646 \u0646\u06CC\u0633\u062A`
      );
    }
    if (st.alert === "overdue") {
      warningsFa.push("\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u067E\u06CC\u0634 \u0627\u0632 \u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0631\u0633\u0645\u06CC \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0628\u0648\u062F");
    }
    return {
      ok: blockersFa.length === 0,
      code: blockersFa.length ? "E-CNT-GRT-RELEASE-BLOCKED" : null,
      messageFa: blockersFa.length ? "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0645\u0645\u06A9\u0646 \u0646\u06CC\u0633\u062A" : "\u0622\u0632\u0627\u062F\u0633\u0627\u0632\u06CC \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u0645\u062C\u0627\u0632 \u0627\u0633\u062A",
      blockersFa,
      warningsFa
    };
  }
  if (st.alert === "overdue") {
    blockersFa.push("\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u0645\u0646\u0642\u0636\u06CC \u0642\u0627\u0628\u0644 \u0636\u0628\u0637 \u0646\u06CC\u0633\u062A\u061B \u0633\u0646\u062F \u0646\u0632\u062F \u0628\u0627\u0646\u06A9 \u0627\u0639\u062A\u0628\u0627\u0631 \u0646\u062F\u0627\u0631\u062F");
  }
  return {
    ok: blockersFa.length === 0,
    code: blockersFa.length ? "E-CNT-GRT-FORFEIT-BLOCKED" : null,
    messageFa: blockersFa.length ? "\u0636\u0628\u0637 \u0645\u0645\u06A9\u0646 \u0646\u06CC\u0633\u062A" : "\u0636\u0628\u0637 \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u0645\u062C\u0627\u0632 \u0627\u0633\u062A",
    blockersFa,
    warningsFa
  };
}
function guaranteeRegister(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const rows = input.rows ?? [];
  const items = rows.map((r) => ({ ...r, state: guaranteeState(r, now) }));
  let totalAmount = 0;
  let liveAmount = 0;
  let expiringSoon = 0;
  let expiredSilently = 0;
  const byType = {};
  for (const it of items) {
    const amt = Number(it.Amount) || 0;
    totalAmount += amt;
    if (it.state.isLive) liveAmount += amt;
    if (it.state.alert === "d30" || it.state.alert === "d10" || it.state.alert === "d3") expiringSoon += 1;
    if (it.state.isExpiredSilently) expiredSilently += 1;
    const t = String(it.GuaranteeType ?? "unknown");
    byType[t] ??= { count: 0, amount: 0 };
    byType[t].count += 1;
    byType[t].amount += amt;
  }
  const coverageGapsFa = [];
  const warningsFa = [];
  const liveOf = (t) => items.some((i) => i.GuaranteeType === t && i.state.isLive);
  if (!liveOf("performance")) {
    coverageGapsFa.push("\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u062A\u0639\u0647\u062F\u0627\u062A \u0645\u0639\u062A\u0628\u0631\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  }
  const outstanding = Number(input.advanceOutstanding);
  if (Number.isFinite(outstanding) && outstanding > 0 && !liveOf("advance")) {
    coverageGapsFa.push(
      `\u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A ${round(outstanding)} \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u200C\u0646\u0634\u062F\u0647 \u062F\u0627\u0631\u062F \u0648\u0644\u06CC \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0639\u062A\u0628\u0631\u06CC \u0646\u06CC\u0633\u062A`
    );
  }
  if (expiredSilently > 0) {
    warningsFa.push(`${expiredSilently} \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A \u0648\u0644\u06CC \u062A\u0627\u0631\u06CC\u062E\u0634 \u06AF\u0630\u0634\u062A\u0647`);
  }
  if (expiringSoon > 0) {
    warningsFa.push(`${expiringSoon} \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647 \u06A9\u0645\u062A\u0631 \u0627\u0632 \u0633\u06CC \u0631\u0648\u0632 \u062A\u0627 \u0627\u0646\u0642\u0636\u0627 \u062F\u0627\u0631\u062F`);
  }
  const ca = Number(input.contractAmount);
  if (Number.isFinite(ca) && ca > 0) {
    const perf = items.filter((i) => i.GuaranteeType === "performance" && i.state.isLive).reduce((s, i) => s + (Number(i.Amount) || 0), 0);
    if (perf > 0) {
      const pct2 = perf / ca * 100;
      if (pct2 < GUARANTEE_CUSTOMARY_PCT.performance / 2) {
        warningsFa.push(
          `\u067E\u0648\u0634\u0634 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u062A\u0639\u0647\u062F\u0627\u062A ${round(pct2)} \u062F\u0631\u0635\u062F \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0627\u0633\u062A \u0648 \u0627\u0632 \u0639\u0631\u0641 \u06A9\u0645\u062A\u0631 \u0627\u0633\u062A`
        );
      }
    }
  }
  return {
    items,
    totalAmount,
    liveAmount,
    byType,
    expiringSoon,
    expiredSilently,
    coverageGapsFa,
    warningsFa
  };
}
var ADVANCE_STATUSES = ["pending", "paid", "recovering", "settled"];
var ADVANCE_STATUS_FA = {
  pending: "\u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0646\u0634\u062F\u0647",
  paid: "\u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0634\u062F\u0647",
  recovering: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0632\u06CC\u0627\u0641\u062A",
  settled: "\u062A\u0633\u0648\u06CC\u0647\u200C\u0634\u062F\u0647"
};
var ADVANCE_DEFAULT_RECOVERY_PCT = 20;
function advanceLedger(rows) {
  const warningsFa = [];
  let paidTotal = 0;
  let recoveredTotal = 0;
  const installments = (rows ?? []).map((r) => {
    const paid = Number(r.PaidAmount) || 0;
    const rec = Number(r.RecoveredToDate) || 0;
    paidTotal += paid;
    recoveredTotal += rec;
    if (rec > paid && paid > 0) {
      warningsFa.push(
        `\u0642\u0633\u0637 ${r.InstallmentNo ?? "\u061F"}: \u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u0627\u0632 \u0645\u0628\u0644\u063A \u067E\u0631\u062F\u0627\u062E\u062A\u06CC \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A`
      );
    }
    const stored = Number(r.OutstandingAmount);
    const computed = round(paid - rec);
    if (Number.isFinite(stored) && Math.abs(stored - computed) > 1) {
      warningsFa.push(
        `\u0642\u0633\u0637 ${r.InstallmentNo ?? "\u061F"}: \u0645\u0627\u0646\u062F\u0647\u0654 \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0628\u0627 \u0645\u0627\u0646\u062F\u0647\u0654 \u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647 \u0646\u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F`
      );
    }
    return {
      ...r,
      statusFa: ADVANCE_STATUS_FA[String(r.Status ?? "pending")] ?? String(r.Status ?? ""),
      outstanding: computed,
      recoveredPct: paid > 0 ? round(rec / paid * 100) : null
    };
  });
  const outstanding = round(paidTotal - recoveredTotal);
  return {
    paidTotal: round(paidTotal),
    recoveredTotal: round(recoveredTotal),
    outstanding,
    recoveredPct: paidTotal > 0 ? round(recoveredTotal / paidTotal * 100) : null,
    /* «تسویه» فقط وقتی که پولی پرداخت شده باشد: دفتر خالی تسویه‌شده
     * نیست، هنوز شروع نشده. */
    isSettled: paidTotal > 0 && outstanding <= 0,
    installments,
    warningsFa
  };
}
function advanceRecovery(input) {
  const warningsFa = [];
  const gross = Number(input.grossAmount) || 0;
  const outstanding = Math.max(0, Number(input.outstanding) || 0);
  let pct2 = Number(input.recoveryPct);
  if (!Number.isFinite(pct2) || pct2 <= 0) {
    pct2 = ADVANCE_DEFAULT_RECOVERY_PCT;
    warningsFa.push(`\u0646\u0631\u062E \u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u062F\u0631 \u067E\u06CC\u0645\u0627\u0646 \u062B\u0628\u062A \u0646\u0634\u062F\u0647\u061B \u0646\u0631\u062E \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 ${ADVANCE_DEFAULT_RECOVERY_PCT} \u062F\u0631\u0635\u062F \u0627\u0639\u0645\u0627\u0644 \u0634\u062F`);
  }
  if (pct2 > 100) {
    pct2 = 100;
    warningsFa.push("\u0646\u0631\u062E \u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u0628\u06CC\u0634 \u0627\u0632 \u0635\u062F \u062F\u0631\u0635\u062F \u0628\u0648\u062F \u0648 \u0628\u0647 \u0635\u062F \u062F\u0631\u0635\u062F \u0645\u062D\u062F\u0648\u062F \u0634\u062F");
  }
  if (gross <= 0) {
    return {
      recoverable: 0,
      appliedPct: pct2,
      outstandingBefore: outstanding,
      outstandingAfter: outstanding,
      isFinalRecovery: false,
      messageFa: "\u0645\u0628\u0644\u063A \u0646\u0627\u062E\u0627\u0644\u0635 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0635\u0641\u0631 \u0627\u0633\u062A\u061B \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u06CC \u0645\u062D\u0627\u0633\u0628\u0647 \u0646\u0634\u062F",
      warningsFa
    };
  }
  if (outstanding <= 0) {
    return {
      recoverable: 0,
      appliedPct: pct2,
      outstandingBefore: 0,
      outstandingAfter: 0,
      isFinalRecovery: false,
      messageFa: "\u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u062A\u0633\u0648\u06CC\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u06A9\u0633\u0631\u06CC \u0628\u0627\u0628\u062A \u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u0646\u062F\u0627\u0631\u062F",
      warningsFa
    };
  }
  const byPct = round(gross * pct2 / 100);
  const recoverable = Math.min(byPct, outstanding);
  const isFinalRecovery = recoverable >= outstanding;
  if (isFinalRecovery && byPct > outstanding) {
    warningsFa.push("\u0633\u0647\u0645 \u062F\u0631\u0635\u062F\u06CC \u0627\u0632 \u0645\u0627\u0646\u062F\u0647\u0654 \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u200C\u0646\u0634\u062F\u0647 \u0628\u06CC\u0634\u062A\u0631 \u0628\u0648\u062F \u0648 \u0628\u0647 \u0645\u0627\u0646\u062F\u0647 \u0645\u062D\u062F\u0648\u062F \u0634\u062F");
  }
  return {
    recoverable: round(recoverable),
    appliedPct: pct2,
    outstandingBefore: round(outstanding),
    outstandingAfter: round(outstanding - recoverable),
    isFinalRecovery,
    messageFa: isFinalRecovery ? "\u0627\u06CC\u0646 \u06A9\u0633\u0631\u060C \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0631\u0627 \u06A9\u0627\u0645\u0644 \u062A\u0633\u0648\u06CC\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F" : `${pct2} \u062F\u0631\u0635\u062F \u06A9\u0627\u0631\u06A9\u0631\u062F \u0646\u0627\u062E\u0627\u0644\u0635 \u0628\u0627\u0628\u062A \u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u06A9\u0633\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F`,
    warningsFa
  };
}
var ADVANCE_CUSTOMARY_CAP_PCT = 25;
function validateAdvanceInput(input) {
  const issues = [];
  const err = (code, messageFa) => issues.push({ code, messageFa, severity: "error" });
  const warn = (code, messageFa) => issues.push({ code, messageFa, severity: "warning" });
  const no = Number(input.installmentNo);
  if (!Number.isInteger(no) || no <= 0) {
    err("E-CNT-ADV-NO", "\u0634\u0645\u0627\u0631\u0647\u0654 \u0642\u0633\u0637 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F \u0635\u062D\u06CC\u062D \u0645\u062B\u0628\u062A \u0628\u0627\u0634\u062F");
  } else if ((input.existingNos ?? []).includes(no)) {
    err("E-CNT-ADV-DUPLICATE", `\u0642\u0633\u0637 \u0634\u0645\u0627\u0631\u0647\u0654 ${no} \u067E\u06CC\u0634\u200C\u062A\u0631 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  const amount = Number(input.paidAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    err("E-CNT-ADV-AMOUNT", "\u0645\u0628\u0644\u063A \u0642\u0633\u0637 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  }
  const pct2 = Number(input.recoveryPct);
  if (input.recoveryPct != null && (!Number.isFinite(pct2) || pct2 <= 0 || pct2 > 100)) {
    err("E-CNT-ADV-PCT", "\u0646\u0631\u062E \u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u0628\u0627\u06CC\u062F \u0628\u06CC\u0646 \u0635\u0641\u0631 \u0648 \u0635\u062F \u0628\u0627\u0634\u062F");
  }
  const ca = Number(input.contractAmount);
  const already = Number(input.alreadyPaid) || 0;
  if (Number.isFinite(ca) && ca > 0 && Number.isFinite(amount) && amount > 0) {
    const total = already + amount;
    const totalPct = total / ca * 100;
    if (totalPct > ADVANCE_CUSTOMARY_CAP_PCT) {
      warn(
        "W-CNT-ADV-CAP",
        `\u0645\u062C\u0645\u0648\u0639 \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A ${round(totalPct)} \u062F\u0631\u0635\u062F \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0633\u0642\u0641 \u0645\u0631\u0633\u0648\u0645 ${ADVANCE_CUSTOMARY_CAP_PCT} \u062F\u0631\u0635\u062F \u0627\u0633\u062A`
      );
    }
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
function guaranteeHealth(input) {
  const { register } = input;
  const gapCount = register.coverageGapsFa.length;
  const status = gapCount > 0 || register.expiredSilently > 0 ? "red" : register.expiringSoon > 0 ? "amber" : "green";
  const parts = [];
  if (gapCount > 0) parts.push(`${gapCount} \u062E\u0644\u0623 \u067E\u0648\u0634\u0634`);
  if (register.expiredSilently > 0) parts.push(`${register.expiredSilently} \u0645\u0646\u0642\u0636\u06CC \u062B\u0628\u062A\u200C\u0646\u0634\u062F\u0647`);
  if (register.expiringSoon > 0) parts.push(`${register.expiringSoon} \u0646\u0632\u062F\u06CC\u06A9 \u0627\u0646\u0642\u0636\u0627`);
  if (input.advance && input.advance.outstanding > 0) {
    parts.push(`${round(input.advance.outstanding)} \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0627\u0632\u06CC\u0627\u0641\u062A\u200C\u0646\u0634\u062F\u0647`);
  }
  return {
    status,
    headlineFa: parts.length ? parts.join(" \xB7 ") : "\u067E\u0648\u0634\u0634 \u0648\u062B\u06CC\u0642\u0647\u200C\u0627\u06CC \u06A9\u0627\u0645\u0644 \u0627\u0633\u062A",
    gapCount,
    expiringSoon: register.expiringSoon,
    expiredSilently: register.expiredSilently
  };
}
var SUB_IPC_STATES = [
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "rejected",
  "paid"
];
var SUB_IPC_STATE_FA = {
  draft: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633",
  submitted: "\u0627\u0631\u0633\u0627\u0644\u200C\u0634\u062F\u0647",
  reviewed: "\u0628\u0631\u0631\u0633\u06CC\u200C\u0634\u062F\u0647",
  approved: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647",
  rejected: "\u0631\u062F\u0634\u062F\u0647",
  paid: "\u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0634\u062F\u0647"
};
var SUB_IPC_TRANSITIONS = {
  draft: ["submitted"],
  submitted: ["reviewed", "rejected"],
  reviewed: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  rejected: ["draft"],
  paid: []
};
var VARIANCE_FLAG_FA = {
  ok: "\u0645\u0646\u0637\u0628\u0642 \u0628\u0627 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC",
  exceeds_main: "\u0628\u06CC\u0634 \u0627\u0632 \u0645\u0642\u062F\u0627\u0631 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u062F\u0631 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC",
  no_main_ref: "\u0628\u062F\u0648\u0646 \u0631\u062F\u06CC\u0641 \u0645\u062A\u0646\u0627\u0638\u0631 \u062F\u0631 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC"
};
var BACK_TO_BACK_SOURCES = [
  "fin_material",
  "hse_incident",
  "qlt_rework",
  "other"
];
var BACK_TO_BACK_SOURCE_FA = {
  fin_material: "\u0645\u0635\u0627\u0644\u062D \u062A\u062D\u0648\u06CC\u0644\u06CC \u06A9\u0627\u0631\u0641\u0631\u0645\u0627",
  hse_incident: "\u062E\u0633\u0627\u0631\u062A \u062D\u0627\u062F\u062B\u0647\u0654 \u0627\u06CC\u0645\u0646\u06CC",
  qlt_rework: "\u062F\u0648\u0628\u0627\u0631\u0647\u200C\u06A9\u0627\u0631\u06CC \u06A9\u06CC\u0641\u06CC",
  other: "\u0633\u0627\u06CC\u0631"
};
var BACK_TO_BACK_STATUS_FA = {
  draft: "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633",
  approved: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647",
  disputed: "\u0645\u0648\u0631\u062F \u0627\u062E\u062A\u0644\u0627\u0641",
  waived: "\u0635\u0631\u0641\u200C\u0646\u0638\u0631 \u0634\u062F\u0647"
};
function subIpcLines(lines) {
  const warningsFa = [];
  const out = [];
  let gross = 0;
  let exceedingCount = 0;
  let unmatchedCount = 0;
  let totalExcessAmount = 0;
  for (const l of lines ?? []) {
    const qty = num(l.Quantity);
    const rate = num(l.UnitRate);
    const amount = l.Amount != null && Number.isFinite(Number(l.Amount)) ? round(Number(l.Amount)) : round(qty * rate);
    gross += amount;
    let varianceFlag = "ok";
    let excessQty = null;
    let excessAmount = null;
    if (!l.BoqItemId) {
      varianceFlag = "no_main_ref";
      unmatchedCount += 1;
    } else if (l.MainApprovedQty == null || !Number.isFinite(Number(l.MainApprovedQty))) {
      varianceFlag = "no_main_ref";
      unmatchedCount += 1;
    } else {
      const approved = Number(l.MainApprovedQty);
      if (qty > approved) {
        varianceFlag = "exceeds_main";
        exceedingCount += 1;
        excessQty = round(qty - approved);
        excessAmount = round(excessQty * rate);
        totalExcessAmount += excessAmount;
      }
    }
    out.push({
      ...l,
      amount,
      varianceFlag,
      varianceFa: VARIANCE_FLAG_FA[varianceFlag],
      excessQty,
      excessAmount
    });
  }
  if (exceedingCount > 0) {
    warningsFa.push(
      `${exceedingCount} \u0631\u062F\u06CC\u0641 \u0628\u06CC\u0634 \u0627\u0632 \u0645\u0642\u062F\u0627\u0631 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u062F\u0631 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC \u0627\u0633\u062A\u061B \u0645\u0627\u0632\u0627\u062F ${round(totalExcessAmount)} \u0627\u0632 \u062C\u06CC\u0628 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u0627\u0635\u0644\u06CC \u0645\u06CC\u200C\u0631\u0648\u062F`
    );
  }
  if (unmatchedCount > 0) {
    warningsFa.push(
      `${unmatchedCount} \u0631\u062F\u06CC\u0641 \u0628\u0647 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC \u06AF\u0631\u0647 \u0646\u062E\u0648\u0631\u062F\u0647 \u0648 \u0642\u0627\u0628\u0644 \u062A\u0637\u0628\u06CC\u0642 \u0646\u06CC\u0633\u062A`
    );
  }
  return {
    lines: out,
    gross: round(gross),
    exceedingCount,
    unmatchedCount,
    totalExcessAmount: round(totalExcessAmount),
    warningsFa
  };
}
function backToBackSummary(rows) {
  const warningsFa = [];
  const byModule = {};
  let approvedTotal = 0;
  let disputedTotal = 0;
  let draftTotal = 0;
  let waivedTotal = 0;
  let missingEvidence = 0;
  const out = (rows ?? []).map((r) => {
    const amount = num(r.Amount);
    const status = String(r.Status ?? "draft");
    const isCountable = status === "approved";
    if (status === "approved") approvedTotal += amount;
    else if (status === "disputed") disputedTotal += amount;
    else if (status === "waived") waivedTotal += amount;
    else draftTotal += amount;
    const mod = String(r.SourceModule ?? "other");
    byModule[mod] = round((byModule[mod] ?? 0) + amount);
    if (isCountable && !String(r.EvidenceDocNo ?? "").trim()) {
      missingEvidence += 1;
    }
    return {
      ...r,
      sourceFa: BACK_TO_BACK_SOURCE_FA[mod] ?? mod,
      statusFa: BACK_TO_BACK_STATUS_FA[status] ?? status,
      isCountable
    };
  });
  if (missingEvidence > 0) {
    warningsFa.push(`${missingEvidence} \u06A9\u0633\u0631 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0633\u0646\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0646\u062F\u0627\u0631\u062F \u0648 \u062F\u0631 \u062F\u0627\u0648\u0631\u06CC \u0642\u0627\u0628\u0644 \u062F\u0641\u0627\u0639 \u0646\u06CC\u0633\u062A`);
  }
  if (disputedTotal > 0) {
    warningsFa.push(`${round(disputedTotal)} \u06A9\u0633\u0631 \u0645\u0648\u0631\u062F \u0627\u062E\u062A\u0644\u0627\u0641 \u0627\u0633\u062A \u0648 \u062A\u0627 \u062D\u0644 \u0627\u062E\u062A\u0644\u0627\u0641 \u0627\u0632 \u067E\u0631\u062F\u0627\u062E\u062A \u06A9\u0645 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F`);
  }
  return {
    rows: out,
    approvedTotal: round(approvedTotal),
    disputedTotal: round(disputedTotal),
    draftTotal: round(draftTotal),
    waivedTotal: round(waivedTotal),
    byModule,
    missingEvidence,
    warningsFa
  };
}
function subIpcTotals(input) {
  const lineSet = subIpcLines(input.lines ?? []);
  const btb = backToBackSummary(input.backToBack ?? []);
  const other = Math.max(0, num(input.otherDeductions));
  const totalDeductions = round(btb.approvedTotal + other);
  const netPayable = round(lineSet.gross - totalDeductions);
  const warningsFa = [...lineSet.warningsFa, ...btb.warningsFa];
  if (netPayable < 0) {
    warningsFa.push(
      `\u06A9\u0633\u0648\u0631 \u0627\u0632 \u06A9\u0627\u0631\u06A9\u0631\u062F \u062F\u0648\u0631\u0647 \u0628\u06CC\u0634\u062A\u0631 \u0627\u0633\u062A\u061B ${round(Math.abs(netPayable))} \u0628\u0647 \u062F\u0648\u0631\u0647\u0654 \u0628\u0639\u062F \u0645\u0646\u062A\u0642\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F`
    );
  }
  return {
    gross: lineSet.gross,
    backToBack: btb.approvedTotal,
    otherDeductions: round(other),
    totalDeductions,
    netPayable,
    exceedingCount: lineSet.exceedingCount,
    unmatchedCount: lineSet.unmatchedCount,
    totalExcessAmount: lineSet.totalExcessAmount,
    isNegative: netPayable < 0,
    warningsFa,
    lineDetail: lineSet.lines,
    backToBackDetail: btb
  };
}
function canTransitionSubIpc(input) {
  const from = String(input.from ?? "draft");
  const to = String(input.to ?? "");
  const blockersFa = [];
  const warningsFa = [];
  if (!SUB_IPC_STATES.includes(to)) {
    return {
      ok: false,
      code: "E-CNT-SUB-STATE",
      messageFa: "\u0648\u0636\u0639\u06CC\u062A \u0645\u0642\u0635\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A",
      blockersFa: ["\u0648\u0636\u0639\u06CC\u062A \u0645\u0642\u0635\u062F \u062F\u0631 \u0648\u0627\u0698\u06AF\u0627\u0646 \u062A\u0639\u0631\u06CC\u0641 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"],
      warningsFa
    };
  }
  const allowed = SUB_IPC_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: "E-CNT-SUB-TRANSITION",
      messageFa: `\u06AF\u0630\u0627\u0631 \u0627\u0632 ${SUB_IPC_STATE_FA[from] ?? from} \u0628\u0647 ${SUB_IPC_STATE_FA[to] ?? to} \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A`,
      blockersFa: allowed.length ? [`\u0627\u0632 \u0627\u06CC\u0646 \u0648\u0636\u0639\u06CC\u062A \u0641\u0642\u0637 ${allowed.map((a) => SUB_IPC_STATE_FA[a]).join(" \u06CC\u0627 ")} \u0645\u0645\u06A9\u0646 \u0627\u0633\u062A`] : ["\u0627\u06CC\u0646 \u0648\u0636\u0639\u06CC\u062A \u067E\u0627\u06CC\u0627\u0646\u06CC \u0627\u0633\u062A \u0648 \u06AF\u0630\u0627\u0631\u06CC \u0646\u062F\u0627\u0631\u062F"],
      warningsFa
    };
  }
  const totals = input.totals ?? null;
  if (to === "approved") {
    const mainState = input.mainIpcState ? String(input.mainIpcState) : null;
    if (!mainState) {
      blockersFa.push("\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u062C\u0632\u0621 \u0628\u0647 \u0647\u06CC\u0686 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC \u06AF\u0631\u0647 \u0646\u062E\u0648\u0631\u062F\u0647 \u0627\u0633\u062A");
    } else if (mainState !== "approved" && mainState !== "paid") {
      blockersFa.push(
        `\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC \u0647\u0646\u0648\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 (\u0648\u0636\u0639\u06CC\u062A \u0641\u0639\u0644\u06CC: ${mainState}); \u062A\u0623\u06CC\u06CC\u062F \u062C\u0632\u0621 \u067E\u06CC\u0634 \u0627\u0632 \u0622\u0646\u060C \u067E\u0631\u062F\u0627\u062E\u062A \u0627\u0632 \u062C\u06CC\u0628 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u0627\u0635\u0644\u06CC \u0627\u0633\u062A`
      );
    }
    if (totals && totals.exceedingCount > 0) {
      blockersFa.push(
        `${totals.exceedingCount} \u0631\u062F\u06CC\u0641 \u0628\u06CC\u0634 \u0627\u0632 \u0645\u0642\u062F\u0627\u0631 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u0627\u0635\u0644\u06CC \u0627\u0633\u062A \u0648 \u0628\u0627\u06CC\u062F \u0627\u0635\u0644\u0627\u062D \u06CC\u0627 \u0628\u0647 \u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F \u062A\u0628\u062F\u06CC\u0644 \u0634\u0648\u062F`
      );
    }
    if (totals && totals.unmatchedCount > 0 && !input.allowUnmatched) {
      blockersFa.push(
        `${totals.unmatchedCount} \u0631\u062F\u06CC\u0641 \u0628\u062F\u0648\u0646 \u0645\u0631\u062C\u0639 \u062F\u0631 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC \u0627\u0633\u062A\u061B \u062A\u0623\u06CC\u06CC\u062F \u0622\u0646 \u0628\u0627\u06CC\u062F \u0635\u0631\u06CC\u062D \u0628\u0627\u0634\u062F`
      );
    }
    const missingEvidence = totals?.backToBackDetail?.missingEvidence ?? 0;
    if (missingEvidence > 0) {
      warningsFa.push(`${missingEvidence} \u06A9\u0633\u0631 \u067E\u0634\u062A\u200C\u0628\u0647\u200C\u067E\u0634\u062A \u0633\u0646\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0646\u062F\u0627\u0631\u062F`);
    }
    if (totals && totals.isNegative) {
      warningsFa.push("\u062E\u0627\u0644\u0635 \u067E\u0631\u062F\u0627\u062E\u062A\u0646\u06CC \u0645\u0646\u0641\u06CC \u0627\u0633\u062A\u061B \u0645\u0627\u0646\u062F\u0647 \u0628\u0647 \u062F\u0648\u0631\u0647\u0654 \u0628\u0639\u062F \u0645\u0646\u062A\u0642\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F");
    }
  }
  if (to === "paid" && totals && totals.netPayable <= 0) {
    blockersFa.push("\u062E\u0627\u0644\u0635 \u067E\u0631\u062F\u0627\u062E\u062A\u0646\u06CC \u0645\u062B\u0628\u062A \u0646\u06CC\u0633\u062A\u061B \u0686\u06CC\u0632\u06CC \u0628\u0631\u0627\u06CC \u067E\u0631\u062F\u0627\u062E\u062A \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F");
  }
  return {
    ok: blockersFa.length === 0,
    code: blockersFa.length ? "E-CNT-SUB-BLOCKED" : null,
    messageFa: blockersFa.length ? "\u06AF\u0630\u0627\u0631 \u0648\u0636\u0639\u06CC\u062A \u0645\u0645\u06A9\u0646 \u0646\u06CC\u0633\u062A" : `\u06AF\u0630\u0627\u0631 \u0628\u0647 ${SUB_IPC_STATE_FA[to] ?? to} \u0645\u062C\u0627\u0632 \u0627\u0633\u062A`,
    blockersFa,
    warningsFa
  };
}
function isSubIpcLocked(state) {
  const s = String(state ?? "draft");
  return s !== "draft" && s !== "rejected";
}
function subIpcRegister(input) {
  const rows = input.rows ?? [];
  const mainStates = input.mainStates ?? {};
  const byState = {};
  let grossTotal = 0;
  let netTotal = 0;
  let deductionTotal = 0;
  let awaitingMain = 0;
  const items = rows.map((r) => {
    const state = String(r.WorkflowState ?? "draft");
    byState[state] = (byState[state] ?? 0) + 1;
    grossTotal += num(r.GrossCurrent);
    netTotal += num(r.NetPayable);
    deductionTotal += num(r.TotalDeductions);
    const mainId = r.MainIpcId ? String(r.MainIpcId) : null;
    const mainState = mainId ? mainStates[mainId] ?? null : null;
    const waiting = (state === "submitted" || state === "reviewed") && mainState !== "approved" && mainState !== "paid";
    if (waiting) awaitingMain += 1;
    return {
      ...r,
      stateFa: SUB_IPC_STATE_FA[state] ?? state,
      isLocked: isSubIpcLocked(state),
      mainIpcState: mainState,
      isAwaitingMain: waiting
    };
  });
  const warningsFa = [];
  if (awaitingMain > 0) {
    warningsFa.push(
      `${awaitingMain} \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u062C\u0632\u0621 \u0645\u0646\u062A\u0638\u0631 \u062A\u0623\u06CC\u06CC\u062F \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0635\u0644\u06CC \u0627\u0633\u062A`
    );
  }
  return {
    items,
    count: rows.length,
    grossTotal: round(grossTotal),
    netTotal: round(netTotal),
    deductionTotal: round(deductionTotal),
    byState,
    awaitingMain,
    warningsFa
  };
}
function validateBackToBack(input) {
  const issues = [];
  const err = (code, messageFa) => issues.push({ code, messageFa, severity: "error" });
  const warn = (code, messageFa) => issues.push({ code, messageFa, severity: "warning" });
  const src = String(input.sourceModule ?? "");
  if (!BACK_TO_BACK_SOURCES.includes(src)) {
    err("E-CNT-BTB-SOURCE", "\u0645\u0646\u0634\u0623 \u06A9\u0633\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A");
  }
  if (!String(input.descriptionFa ?? "").trim()) {
    err("E-CNT-BTB-DESC", "\u0634\u0631\u062D \u06A9\u0633\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A");
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    err("E-CNT-BTB-AMOUNT", "\u0645\u0628\u0644\u063A \u06A9\u0633\u0631 \u0628\u0627\u06CC\u062F \u0639\u062F\u062F\u06CC \u0628\u0632\u0631\u06AF\u200C\u062A\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062F");
  }
  if (src === "other" && String(input.descriptionFa ?? "").trim().length < 10) {
    warn("W-CNT-BTB-VAGUE", "\u06A9\u0633\u0631 \u0628\u0627 \u0645\u0646\u0634\u0623 \xAB\u0633\u0627\u06CC\u0631\xBB \u0628\u0627\u06CC\u062F \u0634\u0631\u062D \u062F\u0642\u06CC\u0642\u200C\u062A\u0631\u06CC \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F");
  }
  if (String(input.status ?? "") === "approved" && !String(input.evidenceDocNo ?? "").trim()) {
    warn("W-CNT-BTB-NO-EVIDENCE", "\u06A9\u0633\u0631 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0628\u062F\u0648\u0646 \u0633\u0646\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u062F\u0631 \u062F\u0627\u0648\u0631\u06CC \u0642\u0627\u0628\u0644 \u062F\u0641\u0627\u0639 \u0646\u06CC\u0633\u062A");
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues };
}
function boqLineAmount(row) {
  const stored = num(row.LineAmount);
  if (stored > 0) return round(stored);
  const lump = num(row.LumpSumAmount);
  if (lump > 0) return round(lump);
  return round(num(row.ContractQty) * num(row.UnitRate));
}
function progressBreakdown(input) {
  const boq = (input.boq ?? []).filter((r) => String(r.Status ?? "active") !== "cancelled");
  const achievedBy = /* @__PURE__ */ new Map();
  for (const a of input.achieved ?? []) {
    const key = String(a.BoqItemId ?? "");
    if (!key) continue;
    const prev = achievedBy.get(key);
    if (!prev || num(a.EarnedCumulative) > num(prev.EarnedCumulative)) achievedBy.set(key, a);
  }
  const lines = [];
  let baseAmount = 0;
  let zeroWeightCount = 0;
  for (const row of boq) {
    const id = String(row.Id ?? "");
    const lineAmount2 = boqLineAmount(row);
    if (lineAmount2 <= 0) zeroWeightCount += 1;
    baseAmount += lineAmount2;
    const got = achievedBy.get(id);
    const contractQty = num(row.ContractQty);
    const cumQty = num(got?.CumQty);
    let earned = num(got?.EarnedCumulative);
    if (earned === 0 && got) {
      const pct2 = num(got.CumPct);
      if (pct2 > 0) earned = round(pct2 / 100 * lineAmount2);
      else if (contractQty > 0) earned = round(cumQty / contractQty * lineAmount2);
    }
    const itemPct = lineAmount2 > 0 ? round(earned / lineAmount2 * 100) : 0;
    lines.push({
      boqItemId: id,
      itemNo: row.ItemNo ?? null,
      titleFa: row.TitleFa ?? null,
      chapterCode: row.ChapterCode ?? null,
      pricingBasis: String(row.PricingBasis ?? "unit_price"),
      contractQty,
      cumQty,
      lineAmount: lineAmount2,
      earnedAmount: round(earned),
      itemPct,
      weightPct: 0,
      /* پس از دانستن مخرج پر می‌شود */
      contributionPct: 0,
      isOverrun: itemPct > 100.00001
    });
  }
  baseAmount = round(baseAmount);
  let earnedTotal = 0;
  for (const l of lines) {
    l.weightPct = baseAmount > 0 ? round(l.lineAmount / baseAmount * 100, 4) : 0;
    l.contributionPct = round(l.weightPct * l.itemPct / 100, 4);
    earnedTotal += l.earnedAmount;
  }
  earnedTotal = round(earnedTotal);
  const physicalPct = baseAmount > 0 ? round(earnedTotal / baseAmount * 100) : 0;
  const chapterMap = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const key = l.chapterCode ?? "\u2014";
    const c = chapterMap.get(key) ?? { weight: 0, earned: 0, base: 0 };
    c.weight += l.weightPct;
    c.earned += l.earnedAmount;
    c.base += l.lineAmount;
    chapterMap.set(key, c);
  }
  const byChapter = [...chapterMap.entries()].map(([chapterCode, c]) => ({
    chapterCode,
    weightPct: round(c.weight, 2),
    progressPct: c.base > 0 ? round(c.earned / c.base * 100) : 0,
    earnedAmount: round(c.earned)
  })).sort((a, b) => b.weightPct - a.weightPct);
  const warningsFa = [];
  if (baseAmount <= 0) {
    warningsFa.push("\u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627 \u0645\u0628\u0644\u063A \u0646\u062F\u0627\u0631\u062F\u061B \u067E\u06CC\u0634\u0631\u0641\u062A \u0648\u0632\u0646\u200C\u062F\u0627\u0631 \u0645\u062D\u0627\u0633\u0628\u0647\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A");
  }
  if (zeroWeightCount > 0) {
    warningsFa.push(`${zeroWeightCount} \u0631\u062F\u06CC\u0641 \u0628\u062F\u0648\u0646 \u0645\u0628\u0644\u063A \u0627\u0633\u062A \u0648 \u062F\u0631 \u0648\u0632\u0646\u200C\u062F\u0647\u06CC \u0646\u0642\u0634\u06CC \u0646\u062F\u0627\u0631\u062F`);
  }
  const overrunCount = lines.filter((l) => l.isOverrun).length;
  if (overrunCount > 0) {
    warningsFa.push(`${overrunCount} \u0631\u062F\u06CC\u0641 \u0628\u06CC\u0634 \u0627\u0632 \u0645\u0642\u062F\u0627\u0631 \u067E\u06CC\u0645\u0627\u0646 \u0627\u062C\u0631\u0627 \u0634\u062F\u0647 \u0627\u0633\u062A`);
  }
  return {
    lines,
    baseAmount,
    earnedAmount: earnedTotal,
    physicalPct,
    lineCount: lines.length,
    startedCount: lines.filter((l) => l.itemPct > 0).length,
    completedCount: lines.filter((l) => l.itemPct >= 99.999).length,
    overrunCount,
    zeroWeightCount,
    byChapter,
    warningsFa
  };
}
function financialProgress(input) {
  const amount = round(num(input.contractAmount));
  const rows = (input.ipcs ?? []).filter((x) => String(x.Status ?? "open") !== "cancelled");
  const APPROVED = /* @__PURE__ */ new Set(["approved", "paid"]);
  const PENDING = /* @__PURE__ */ new Set(["submitted", "reviewed", "consultant_approved"]);
  let approvedGross = 0;
  let approvedNet = 0;
  let paidNet = 0;
  let pendingGross = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  for (const x of rows) {
    const state = String(x.WorkflowState ?? "draft");
    const gross = num(x.GrossCumulative) || num(x.GrossCurrent);
    if (APPROVED.has(state)) {
      approvedCount += 1;
      approvedGross = Math.max(approvedGross, gross);
      approvedNet += num(x.NetPayable);
      if (state === "paid") paidNet += num(x.NetPayable);
    } else if (PENDING.has(state)) {
      pendingCount += 1;
      pendingGross += num(x.GrossCurrent);
    }
  }
  approvedGross = round(approvedGross);
  approvedNet = round(approvedNet);
  paidNet = round(paidNet);
  pendingGross = round(pendingGross);
  const financialPct = amount > 0 ? round(approvedGross / amount * 100) : 0;
  const paidPct = amount > 0 ? round(paidNet / amount * 100) : 0;
  const ceiling = num(input.ceilingPct);
  const ceilingAmount = ceiling > 0 ? amount * (1 + ceiling / 100) : amount;
  const ceilingUsedPct = ceilingAmount > 0 ? round(approvedGross / ceilingAmount * 100) : 0;
  const warningsFa = [];
  if (amount <= 0) warningsFa.push("\u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0635\u0641\u0631 \u0627\u0633\u062A\u061B \u062F\u0631\u0635\u062F \u0645\u0627\u0644\u06CC \u0645\u0639\u0646\u0627 \u0646\u062F\u0627\u0631\u062F");
  if (financialPct > 100) {
    warningsFa.push(`\u06A9\u0627\u0631\u06A9\u0631\u062F \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 ${round(financialPct - 100)}\u066A \u0627\u0632 \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0641\u0631\u0627\u062A\u0631 \u0631\u0641\u062A\u0647 \u0627\u0633\u062A`);
  }
  if (pendingCount > 0) {
    warningsFa.push(`${pendingCount} \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u062F\u0631 \u062C\u0631\u06CC\u0627\u0646 \u0628\u0631\u0631\u0633\u06CC \u0627\u0633\u062A \u0648 \u062F\u0631 \u062F\u0631\u0635\u062F \u0645\u0627\u0644\u06CC \u0646\u06CC\u0627\u0645\u062F\u0647`);
  }
  return {
    contractAmount: amount,
    approvedGross,
    approvedNet,
    paidNet,
    pendingGross,
    financialPct,
    paidPct,
    ceilingUsedPct,
    approvedCount,
    pendingCount,
    warningsFa
  };
}
var PROGRESS_GAP_FA = {
  balanced: "\u0645\u062A\u0648\u0627\u0632\u0646",
  overpaid: "\u067E\u0631\u062F\u0627\u062E\u062A \u062C\u0644\u0648\u062A\u0631 \u0627\u0632 \u06A9\u0627\u0631",
  underpaid: "\u06A9\u0627\u0631 \u062C\u0644\u0648\u062A\u0631 \u0627\u0632 \u067E\u0631\u062F\u0627\u062E\u062A",
  unknown: "\u0642\u0627\u0628\u0644 \u0633\u0646\u062C\u0634 \u0646\u06CC\u0633\u062A"
};
var PROGRESS_GAP_TOLERANCE_PCT = 5;
function progressGap(input) {
  const phys = round(num(input.physicalPct));
  const fin = round(num(input.financialPct));
  const tol = input.tolerancePct == null ? PROGRESS_GAP_TOLERANCE_PCT : num(input.tolerancePct);
  const gap = round(fin - phys);
  const amount = round(num(input.contractAmount));
  const exposure = round(Math.abs(gap) / 100 * amount);
  let verdict = "balanced";
  if (phys <= 0 && fin <= 0) verdict = "unknown";
  else if (gap > tol) verdict = "overpaid";
  else if (gap < -tol) verdict = "underpaid";
  const messageFa = verdict === "unknown" ? "\u0647\u0646\u0648\u0632 \u0646\u0647 \u06A9\u0627\u0631\u06CC \u062B\u0628\u062A \u0634\u062F\u0647 \u0646\u0647 \u067E\u0631\u062F\u0627\u062E\u062A\u06CC \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647" : verdict === "overpaid" ? `\u067E\u0631\u062F\u0627\u062E\u062A ${Math.abs(gap)}\u066A \u0627\u0632 \u06A9\u0627\u0631\u06A9\u0631\u062F \u062C\u0644\u0648\u062A\u0631 \u0627\u0633\u062A\u061B \u0645\u0639\u0627\u062F\u0644 ${exposure} \u0631\u06CC\u0627\u0644 \u0627\u0636\u0627\u0641\u0647\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u062D\u062A\u0645\u0644` : verdict === "underpaid" ? `\u06A9\u0627\u0631\u06A9\u0631\u062F ${Math.abs(gap)}\u066A \u0627\u0632 \u067E\u0631\u062F\u0627\u062E\u062A \u062C\u0644\u0648\u062A\u0631 \u0627\u0633\u062A\u061B \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u0645\u0639\u0627\u062F\u0644 ${exposure} \u0631\u06CC\u0627\u0644 \u0631\u0627 \u0627\u0632 \u0645\u0646\u0627\u0628\u0639 \u062E\u0648\u062F \u062A\u0623\u0645\u06CC\u0646 \u06A9\u0631\u062F\u0647` : "\u0641\u0627\u0635\u0644\u0647\u0654 \u067E\u06CC\u0634\u0631\u0641\u062A \u0641\u06CC\u0632\u06CC\u06A9\u06CC \u0648 \u0645\u0627\u0644\u06CC \u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0645\u062A\u0639\u0627\u0631\u0641 \u0627\u0633\u062A";
  return {
    physicalPct: phys,
    financialPct: fin,
    gapPct: gap,
    verdict,
    verdictFa: PROGRESS_GAP_FA[verdict],
    exposureAmount: exposure,
    messageFa,
    isMaterial: verdict === "overpaid" || verdict === "underpaid"
  };
}
function sCurve(input) {
  const plannedBy = /* @__PURE__ */ new Map();
  for (const p of input.planned ?? []) {
    const key = String(p.periodCode ?? "").trim();
    if (!key) continue;
    plannedBy.set(key, { pct: round(num(p.cumPct)), amount: round(num(p.cumAmount)) });
  }
  const actualBy = /* @__PURE__ */ new Map();
  for (const a of input.actual ?? []) {
    const key = String(a.periodCode ?? "").trim();
    if (!key) continue;
    actualBy.set(key, { pct: round(num(a.cumPct)), amount: round(num(a.cumAmount)) });
  }
  const periods = [.../* @__PURE__ */ new Set([...plannedBy.keys(), ...actualBy.keys()])].sort();
  const lastActualPeriod = [...actualBy.keys()].sort().pop() ?? null;
  const points = [];
  let carriedActualPct = 0;
  let carriedActualAmount = 0;
  for (const periodCode of periods) {
    const plan = plannedBy.get(periodCode) ?? { pct: 0, amount: 0 };
    const act = actualBy.get(periodCode);
    const isForecast = lastActualPeriod == null || periodCode > lastActualPeriod;
    if (act) {
      carriedActualPct = act.pct;
      carriedActualAmount = act.amount;
    }
    const actualPct = isForecast ? carriedActualPct : act?.pct ?? carriedActualPct;
    const actualAmount = isForecast ? carriedActualAmount : act?.amount ?? carriedActualAmount;
    points.push({
      periodCode,
      plannedPct: plan.pct,
      actualPct,
      plannedAmount: plan.amount,
      actualAmount,
      variancePct: round(actualPct - plan.pct),
      isForecast
    });
  }
  const realPoints = points.filter((p) => !p.isForecast);
  const worst = realPoints.reduce(
    (m, p) => m == null || p.variancePct < m.variancePct ? p : m,
    null
  );
  const warningsFa = [];
  if (!points.length) warningsFa.push("\u062F\u0627\u062F\u0647\u200C\u0627\u06CC \u0628\u0631\u0627\u06CC \u0631\u0633\u0645 \u0645\u0646\u062D\u0646\u06CC S \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F");
  if (!plannedBy.size && actualBy.size) {
    warningsFa.push("\u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647\u061B \u0627\u0646\u062D\u0631\u0627\u0641 \u0642\u0627\u0628\u0644 \u0633\u0646\u062C\u0634 \u0646\u06CC\u0633\u062A");
  }
  if (worst && worst.variancePct < 0) {
    warningsFa.push(`\u0628\u06CC\u0634\u062A\u0631\u06CC\u0646 \u0639\u0642\u0628\u200C\u0645\u0627\u0646\u062F\u06AF\u06CC ${Math.abs(worst.variancePct)}\u066A \u062F\u0631 \u062F\u0648\u0631\u0647\u0654 ${worst.periodCode}`);
  }
  return {
    points,
    latest: realPoints.length ? realPoints[realPoints.length - 1] : null,
    dataThroughPeriod: lastActualPeriod,
    maxLagPct: worst && worst.variancePct < 0 ? round(Math.abs(worst.variancePct)) : 0,
    worstPeriod: worst && worst.variancePct < 0 ? worst.periodCode : null,
    warningsFa
  };
}
var MILESTONE_STATUS_FA = {
  planned: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647",
  pending: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647",
  in_progress: "\u062F\u0631 \u062D\u0627\u0644 \u0627\u062C\u0631\u0627",
  achieved: "\u0645\u062D\u0642\u0642\u200C\u0634\u062F\u0647",
  claimed: "\u0645\u062D\u0642\u0642\u200C\u0634\u062F\u0647 (\u0627\u062F\u0639\u0627\u06CC\u06CC)",
  verified: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647",
  rejected: "\u0631\u062F\u0634\u062F\u0647",
  cancelled: "\u0644\u063A\u0648\u0634\u062F\u0647"
};
var MILESTONE_EFFECTIVE_STATUS = {
  planned: "planned",
  pending: "planned",
  in_progress: "planned",
  achieved: "achieved",
  claimed: "achieved",
  verified: "verified",
  rejected: "dropped",
  cancelled: "dropped"
};
function milestoneRollup(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const requireEvidence = input.requireEvidence !== false;
  const rows = (input.rows ?? []).filter(
    (r) => MILESTONE_EFFECTIVE_STATUS[String(r.Status ?? "planned")] !== "dropped"
  );
  let totalWeight = 0;
  let weighted = 0;
  let lateCount = 0;
  let missingEvidence = 0;
  const items = rows.map((r) => {
    const status = String(r.Status ?? "planned");
    const eff = MILESTONE_EFFECTIVE_STATUS[status] ?? "planned";
    const weight = num(r.WeightPct);
    totalWeight += weight;
    let effective = num(r.AchievedPct);
    if (eff === "verified") effective = 100;
    else if (eff === "achieved" && effective === 0) effective = 100;
    const needsEvidence = requireEvidence && effective > 0 && !String(r.EvidenceDocNo ?? "").trim();
    if (needsEvidence) missingEvidence += 1;
    const counted = needsEvidence ? effective / 2 : effective;
    weighted += weight * counted / 100;
    let lateDays = 0;
    let isLate = false;
    const planned = String(r.PlannedDate ?? "").trim();
    if (planned && effective < 100) {
      const p = new Date(planned);
      if (!Number.isNaN(p.getTime())) {
        const diff = Math.floor((now.getTime() - p.getTime()) / 864e5);
        if (diff > 0) {
          isLate = true;
          lateDays = diff;
        }
      }
    }
    if (isLate) lateCount += 1;
    return {
      ...r,
      statusFa: MILESTONE_STATUS_FA[status] ?? status,
      effectivePct: round(effective),
      contributionPct: round(weight * counted / 100, 4),
      isLate,
      lateDays,
      needsEvidence
    };
  });
  totalWeight = round(totalWeight, 4);
  const progressPct = totalWeight > 0 ? round(weighted / totalWeight * 100) : 0;
  const warningsFa = [];
  if (rows.length && Math.abs(totalWeight - 100) > 0.5) {
    warningsFa.push(`\u062C\u0645\u0639 \u0648\u0632\u0646 \u0646\u0642\u0627\u0637 \u0639\u0637\u0641 ${totalWeight}\u066A \u0627\u0633\u062A\u060C \u0646\u0647 \u06F1\u06F0\u06F0\u066A`);
  }
  if (missingEvidence > 0) {
    warningsFa.push(`${missingEvidence} \u0646\u0642\u0637\u0647\u0654 \u0639\u0637\u0641 \u0628\u062F\u0648\u0646 \u0633\u0646\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0627\u0633\u062A \u0648 \u0646\u06CC\u0645\u200C\u0634\u0645\u0631\u062F\u0647 \u0634\u062F\u0647`);
  }
  if (lateCount > 0) {
    warningsFa.push(`${lateCount} \u0646\u0642\u0637\u0647\u0654 \u0639\u0637\u0641 \u0627\u0632 \u062A\u0627\u0631\u06CC\u062E \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC \u0639\u0642\u0628 \u0627\u0633\u062A`);
  }
  return {
    items,
    totalWeightPct: totalWeight,
    progressPct,
    achievedCount: items.filter((i) => i.effectivePct >= 100).length,
    verifiedCount: items.filter(
      (i) => MILESTONE_EFFECTIVE_STATUS[String(i.Status ?? "planned")] === "verified"
    ).length,
    lateCount,
    missingEvidence,
    warningsFa
  };
}
function progressSnapshot(input) {
  const physical = progressBreakdown({ boq: input.boq ?? [], achieved: input.achieved });
  const financial = financialProgress({
    contractAmount: input.contractAmount,
    ipcs: input.ipcs ?? [],
    ceilingPct: input.ceilingPct
  });
  const hasMilestones = (input.milestones ?? []).length > 0;
  const milestones = hasMilestones ? milestoneRollup({ rows: input.milestones ?? [], now: input.now }) : null;
  const useBoq = physical.baseAmount > 0;
  const physicalSource = useBoq ? "boq" : milestones ? "milestone" : "none";
  const physicalPct = useBoq ? physical.physicalPct : milestones?.progressPct ?? 0;
  const gap = progressGap({
    physicalPct,
    financialPct: financial.financialPct,
    contractAmount: input.contractAmount
  });
  const warningsFa = [
    ...physical.warningsFa,
    ...financial.warningsFa,
    ...milestones?.warningsFa ?? []
  ];
  if (physicalSource === "none") {
    warningsFa.unshift("\u0646\u0647 \u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627\u06CC \u0645\u0628\u0644\u063A\u200C\u062F\u0627\u0631 \u062B\u0628\u062A \u0634\u062F\u0647 \u0646\u0647 \u0646\u0642\u0637\u0647\u0654 \u0639\u0637\u0641\u061B \u067E\u06CC\u0634\u0631\u0641\u062A \u0641\u06CC\u0632\u06CC\u06A9\u06CC \u0635\u0641\u0631 \u0641\u0631\u0636 \u0634\u062F");
  }
  const coverage = useBoq && input.contractAmount > 0 ? round(physical.baseAmount / num(input.contractAmount) * 100) : null;
  if (coverage != null && Math.abs(coverage - 100) > 5) {
    warningsFa.unshift(
      coverage < 100 ? `\u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627 \u062A\u0646\u0647\u0627 ${coverage}\u066A \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0631\u0627 \u067E\u0648\u0634\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u0641\u0627\u0635\u0644\u0647\u0654 \u0641\u06CC\u0632\u06CC\u06A9\u06CC \u0648 \u0645\u0627\u0644\u06CC \u062A\u0627 \u062A\u06A9\u0645\u06CC\u0644 \u0622\u0646 \u06AF\u0645\u0631\u0627\u0647\u200C\u06A9\u0646\u0646\u062F\u0647 \u0627\u0633\u062A` : `\u062C\u0645\u0639 \u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627 ${coverage}\u066A \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0627\u0633\u062A\u061B \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u06CC\u0627 \u0641\u0647\u0631\u0633\u062A\u200C\u0628\u0647\u0627 \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC \u0634\u0648\u062F`
    );
  }
  if (gap.isMaterial) warningsFa.unshift(gap.messageFa);
  return {
    periodCode: input.periodCode ?? null,
    physicalPct,
    financialPct: financial.financialPct,
    /** درصد پوشش فهرست‌بها از مبلغ پیمان؛ `null` یعنی قابل سنجش نیست. */
    boqCoveragePct: coverage,
    /** آیا فاصله بر دو مخرج ناهمخوان سنجیده شده. */
    isGapReliable: coverage == null || Math.abs(coverage - 100) <= 5,
    gap,
    physical,
    financial,
    milestones,
    physicalSource,
    warningsFa
  };
}
var CONTRACT_KPI_CATALOG = [
  {
    code: "physical_pct",
    titleFa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0641\u06CC\u0632\u06CC\u06A9\u06CC",
    unit: "pct",
    direction: "higher_better",
    weight: 0,
    hintFa: "\u06A9\u0627\u0631\u0650 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0646\u0633\u0628\u062A \u0628\u0647 \u06A9\u0644 \u2014 \u0645\u0628\u0646\u0627\u06CC \u0645\u0642\u0627\u06CC\u0633\u0647\u060C \u0646\u0647 \u062E\u0648\u062F\u0634 \u0646\u0645\u0631\u0647"
  },
  {
    code: "financial_pct",
    titleFa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0627\u0644\u06CC",
    unit: "pct",
    direction: "higher_better",
    weight: 0,
    hintFa: "\u067E\u0648\u0644\u0650 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0646\u0633\u0628\u062A \u0628\u0647 \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646"
  },
  {
    code: "progress_gap_pct",
    titleFa: "\u0641\u0627\u0635\u0644\u0647\u0654 \u0645\u0627\u0644\u06CC \u0648 \u0641\u06CC\u0632\u06CC\u06A9\u06CC",
    unit: "pct",
    direction: "lower_better",
    weight: 25,
    hintFa: "\u0645\u062B\u0628\u062A \u06CC\u0639\u0646\u06CC \u067E\u0648\u0644 \u062C\u0644\u0648\u062A\u0631 \u0627\u0632 \u06A9\u0627\u0631 \u0631\u0641\u062A\u0647"
  },
  {
    code: "ceiling_used_pct",
    titleFa: "\u0645\u0635\u0631\u0641 \u0633\u0642\u0641",
    unit: "pct",
    direction: "lower_better",
    weight: 20,
    hintFa: "\u06A9\u0627\u0631\u06A9\u0631\u062F \u0646\u0633\u0628\u062A \u0628\u0647 \u0633\u0642\u0641 \u0645\u062C\u0627\u0632 \u0634\u0627\u0645\u0644 \u06F2\u06F5\u066A \u0645\u0627\u062F\u0647 \u06F2\u06F9"
  },
  {
    code: "advance_recovered_pct",
    titleFa: "\u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A",
    unit: "pct",
    direction: "higher_better",
    weight: 15,
    hintFa: "\u0686\u0647 \u0633\u0647\u0645\u06CC \u0627\u0632 \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0627\u0632\u06AF\u0634\u062A\u0647"
  },
  {
    code: "extra_work_ratio_pct",
    titleFa: "\u0646\u0633\u0628\u062A \u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F",
    unit: "pct",
    direction: "lower_better",
    weight: 15,
    hintFa: "\u0633\u0647\u0645 \u0631\u062F\u06CC\u0641\u200C\u0647\u0627\u06CC \u0633\u062A\u0627\u0631\u0647\u200C\u062F\u0627\u0631 \u0648 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u0642\u0627\u062F\u06CC\u0631 \u0627\u0632 \u06A9\u0627\u0631\u06A9\u0631\u062F"
  },
  {
    code: "avg_ipc_cycle_days",
    titleFa: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0686\u0631\u062E\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A",
    unit: "days",
    direction: "lower_better",
    weight: 15,
    hintFa: "\u0627\u0632 \u0627\u0631\u0633\u0627\u0644 \u062A\u0627 \u062A\u0623\u06CC\u06CC\u062F \u06A9\u0627\u0631\u0641\u0631\u0645\u0627"
  },
  {
    code: "open_guarantee_count",
    titleFa: "\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u0628\u0627\u0632",
    unit: "count",
    direction: "lower_better",
    weight: 0,
    hintFa: "\u062A\u0639\u062F\u0627\u062F \u0648\u062B\u06CC\u0642\u0647\u0654 \u062F\u0631 \u062C\u0631\u06CC\u0627\u0646"
  },
  {
    code: "expiring_guarantee_count",
    titleFa: "\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u0631\u0648 \u0628\u0647 \u0627\u0646\u0642\u0636\u0627",
    unit: "count",
    direction: "lower_better",
    weight: 10,
    hintFa: "\u06A9\u0645\u062A\u0631 \u0627\u0632 \u06F3\u06F0 \u0631\u0648\u0632 \u062A\u0627 \u0633\u0631\u0631\u0633\u06CC\u062F"
  },
  {
    code: "retainage_balance",
    titleFa: "\u0645\u0627\u0646\u062F\u0647\u0654 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u06A9\u0627\u0631",
    unit: "amount",
    direction: "higher_better",
    weight: 0,
    hintFa: "\u0633\u067E\u0631\u062F\u0647\u0654 \u06A9\u0633\u0631\u0634\u062F\u0647 \u0648 \u0622\u0632\u0627\u062F\u0646\u0634\u062F\u0647"
  }
];
var KPI_BY_CODE = Object.fromEntries(
  CONTRACT_KPI_CATALOG.map((k) => [k.code, k])
);
var IPC_STAGE_FA = {
  submitted: "\u0645\u0646\u062A\u0638\u0631 \u0628\u0631\u0631\u0633\u06CC \u0645\u0634\u0627\u0648\u0631",
  consultant_approved: "\u0645\u0646\u062A\u0638\u0631 \u062A\u0623\u06CC\u06CC\u062F \u06A9\u0627\u0631\u0641\u0631\u0645\u0627",
  reviewed: "\u0645\u0646\u062A\u0638\u0631 \u062A\u0623\u06CC\u06CC\u062F \u06A9\u0627\u0631\u0641\u0631\u0645\u0627",
  approved: "\u0645\u0646\u062A\u0638\u0631 \u067E\u0631\u062F\u0627\u062E\u062A"
};
function cycleDays(a, b) {
  const d = daysBetween(String(a ?? "").trim() || null, String(b ?? "").trim() || null);
  return d == null ? null : Math.max(0, d);
}
function ipcCycle(input) {
  const now = input.now ?? /* @__PURE__ */ new Date();
  const rows = (input.rows ?? []).filter((r) => String(r.Status ?? "open") !== "cancelled");
  const closed = [];
  const open = [];
  for (const r of rows) {
    const state = String(r.WorkflowState ?? "draft");
    const submitted = String(r.SubmittedAt ?? "").trim();
    if (!submitted) continue;
    const end = String(r.EmployerApprovedAt ?? "").trim();
    if (end) {
      const days = cycleDays(submitted, end);
      if (days != null) {
        closed.push({
          serialNo: r.SerialNo ?? null,
          days,
          consultantDays: cycleDays(submitted, r.ConsultantApprovedAt)
        });
      }
      continue;
    }
    if (["approved", "paid"].includes(state)) continue;
    const age = cycleDays(submitted, now.toISOString());
    if (age != null) {
      open.push({
        serialNo: r.SerialNo ?? null,
        ageDays: age,
        stage: state,
        stageFa: IPC_STAGE_FA[state] ?? state
      });
    }
  }
  const closedDays = closed.map((c) => c.days);
  const avgDays = closedDays.length ? round(closedDays.reduce((s, d) => s + d, 0) / closedDays.length, 1) : 0;
  const maxDays = closedDays.length ? Math.max(...closedDays) : 0;
  const allDays = [...closedDays, ...open.map((o) => o.ageDays)];
  const avgIncludingOpenDays = allDays.length ? round(allDays.reduce((s, d) => s + d, 0) / allDays.length, 1) : 0;
  const oldestOpenDays = open.length ? Math.max(...open.map((o) => o.ageDays)) : 0;
  const warningsFa = [];
  if (open.length && avgIncludingOpenDays > avgDays + 5) {
    warningsFa.push(
      `\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0628\u0627 \u0627\u062D\u062A\u0633\u0627\u0628 ${open.length} \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0628\u0627\u0632 ${avgIncludingOpenDays} \u0631\u0648\u0632 \u0627\u0633\u062A\u060C \u0646\u0647 ${avgDays} \u0631\u0648\u0632`
    );
  }
  if (oldestOpenDays > 60) {
    const worst = open.find((o) => o.ageDays === oldestOpenDays);
    warningsFa.push(
      `\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A ${worst?.serialNo ?? "\u2014"} \u067E\u0633 \u0627\u0632 ${oldestOpenDays} \u0631\u0648\u0632 \u0647\u0646\u0648\u0632 ${worst?.stageFa ?? "\u0628\u0627\u0632"} \u0627\u0633\u062A`
    );
  }
  return {
    closed: closed.sort((a, b) => (a.serialNo ?? 0) - (b.serialNo ?? 0)),
    open: open.sort((a, b) => b.ageDays - a.ageDays),
    avgDays,
    maxDays,
    avgIncludingOpenDays,
    openCount: open.length,
    oldestOpenDays,
    warningsFa
  };
}
function extraWorkRatio(input) {
  const base = round(num(input.initialAmount));
  const live = (input.boq ?? []).filter((x) => String(x.Status ?? "active") !== "cancelled");
  const starred = live.filter((x) => x.IsStarred === true || x.IsStarred === 1 || x.IsStarred === "1");
  const starredAmount = round(starred.reduce((s, x) => s + boqLineAmount(x), 0));
  const changeRows = (input.changes ?? []).filter((x) => String(x.Status ?? "approved") !== "cancelled");
  const changeAmount = round(
    changeRows.reduce((s, x) => s + (num(x.DeltaAmount) || num(x.Amount)), 0)
  );
  const extraTotal = round(starredAmount + changeAmount);
  const ratioPct = base > 0 ? round(extraTotal / base * 100) : 0;
  const isMeasurable = live.length > 0 || changeRows.length > 0;
  const warningsFa = [];
  if (base <= 0) warningsFa.push("\u0645\u0628\u0644\u063A \u0627\u0648\u0644\u06CC\u0647\u0654 \u067E\u06CC\u0645\u0627\u0646 \u0635\u0641\u0631 \u0627\u0633\u062A\u061B \u0646\u0633\u0628\u062A \u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F \u0645\u0639\u0646\u0627 \u0646\u062F\u0627\u0631\u062F");
  if (ratioPct > 25) {
    warningsFa.push(`\u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F ${ratioPct}\u066A \u0645\u0628\u0644\u063A \u0627\u0648\u0644\u06CC\u0647 \u0627\u0633\u062A \u0648 \u0627\u0632 \u0633\u0642\u0641 \u0645\u0627\u062F\u0647 \u06F2\u06F9 \u0639\u0628\u0648\u0631 \u06A9\u0631\u062F\u0647`);
  }
  return {
    starredAmount,
    changeAmount,
    extraTotal,
    baseAmount: base,
    ratioPct,
    isMeasurable,
    starredCount: starred.length,
    changeCount: changeRows.length,
    warningsFa
  };
}
function kpiDisplay(value, unit) {
  if (value == null) return "\u2014";
  if (unit === "pct") return `${round(value)}\u066A`;
  if (unit === "days") return `${round(value, 1)} \u0631\u0648\u0632`;
  if (unit === "count") return String(Math.round(value));
  return String(round(value));
}
function contractKpis(input) {
  const raw = {
    physical_pct: input.physicalPct,
    financial_pct: input.financialPct,
    progress_gap_pct: input.gapPct,
    ceiling_used_pct: input.ceilingUsedPct,
    advance_recovered_pct: input.advanceRecoveredPct,
    extra_work_ratio_pct: input.extraWorkRatioPct,
    avg_ipc_cycle_days: input.avgIpcCycleDays,
    open_guarantee_count: input.openGuaranteeCount,
    expiring_guarantee_count: input.expiringGuaranteeCount,
    retainage_balance: input.retainageBalance
  };
  const values = CONTRACT_KPI_CATALOG.map((spec) => {
    const v = raw[spec.code];
    const value = v == null || !Number.isFinite(Number(v)) ? null : round(Number(v));
    return {
      code: spec.code,
      titleFa: spec.titleFa,
      unit: spec.unit,
      direction: spec.direction,
      value,
      displayFa: kpiDisplay(value, spec.unit),
      isComputable: value != null
    };
  });
  const byCode = Object.fromEntries(values.map((v) => [v.code, v.value]));
  const computableCount = values.filter((v) => v.isComputable).length;
  const warningsFa = [];
  if (computableCount < 4) {
    warningsFa.push("\u062F\u0627\u062F\u0647\u0654 \u06A9\u0627\u0641\u06CC \u0628\u0631\u0627\u06CC \u0633\u0646\u062C\u0634 \u0633\u0644\u0627\u0645\u062A \u067E\u06CC\u0645\u0627\u0646 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F");
  }
  return {
    periodCode: input.periodCode ?? null,
    values,
    byCode,
    computableCount,
    warningsFa
  };
}
var ALERT_SEVERITY_FA = {
  info: "\u0627\u0637\u0644\u0627\u0639\u06CC",
  warning: "\u0647\u0634\u062F\u0627\u0631",
  critical: "\u0628\u062D\u0631\u0627\u0646\u06CC"
};
var ALERT_SEVERITY_RANK = {
  info: 1,
  warning: 2,
  critical: 3
};
var DEFAULT_ALERT_RULES = [
  {
    code: "EWS-01",
    titleFa: "\u0627\u0636\u0627\u0641\u0647\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0647 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631",
    kpi: "progress_gap_pct",
    op: "gt",
    threshold: 10,
    severity: "critical",
    actionFa: "\u067E\u06CC\u0634 \u0627\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0628\u0639\u062F\u06CC\u060C \u062A\u0637\u0628\u06CC\u0642 \u0645\u062A\u0631\u0647 \u0628\u0627 \u06A9\u0627\u0631\u06A9\u0631\u062F \u0648\u0627\u0642\u0639\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A"
  },
  {
    code: "EWS-02",
    titleFa: "\u06A9\u0627\u0631\u06A9\u0631\u062F \u062A\u0623\u06CC\u06CC\u062F\u0646\u0634\u062F\u0647\u0654 \u0627\u0646\u0628\u0627\u0634\u062A\u0647",
    kpi: "progress_gap_pct",
    op: "lt",
    threshold: -15,
    severity: "warning",
    actionFa: "\u0639\u0644\u062A \u062A\u0623\u062E\u06CC\u0631 \u062F\u0631 \u062A\u0623\u06CC\u06CC\u062F \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0628\u0631\u0631\u0633\u06CC \u0634\u0648\u062F\u061B \u0631\u06CC\u0633\u06A9 \u0627\u062F\u0639\u0627\u06CC \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631"
  },
  {
    code: "EWS-03",
    titleFa: "\u0646\u0632\u062F\u06CC\u06A9 \u0634\u062F\u0646 \u0628\u0647 \u0633\u0642\u0641 \u067E\u06CC\u0645\u0627\u0646",
    kpi: "ceiling_used_pct",
    op: "gt",
    threshold: 90,
    severity: "critical",
    actionFa: "\u062A\u0634\u0631\u06CC\u0641\u0627\u062A \u0627\u0644\u062D\u0627\u0642\u06CC\u0647 \u067E\u06CC\u0634 \u0627\u0632 \u0631\u0633\u06CC\u062F\u0646 \u0628\u0647 \u0633\u0642\u0641 \u0622\u063A\u0627\u0632 \u0634\u0648\u062F"
  },
  {
    code: "EWS-04",
    titleFa: "\u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F \u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u0645\u0627\u062F\u0647 \u06F2\u06F9",
    kpi: "extra_work_ratio_pct",
    op: "gt",
    threshold: 25,
    severity: "critical",
    actionFa: "\u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F \u0628\u062F\u0648\u0646 \u0627\u0644\u062D\u0627\u0642\u06CC\u0647 \u0642\u0627\u0628\u0644 \u067E\u0631\u062F\u0627\u062E\u062A \u0646\u06CC\u0633\u062A\u061B \u0645\u0635\u0648\u0628\u0647 \u0627\u062E\u0630 \u0634\u0648\u062F"
  },
  {
    code: "EWS-05",
    titleFa: "\u06A9\u0646\u062F\u06CC \u0686\u0631\u062E\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A",
    kpi: "avg_ipc_cycle_days",
    op: "gt",
    threshold: 45,
    severity: "warning",
    actionFa: "\u06AF\u0644\u0648\u06AF\u0627\u0647 \u0628\u0631\u0631\u0633\u06CC \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0634\u0648\u062F\u061B \u062A\u0623\u062E\u06CC\u0631 \u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0647 \u0627\u062F\u0639\u0627\u06CC \u062E\u0633\u0627\u0631\u062A \u0645\u06CC\u200C\u0627\u0646\u062C\u0627\u0645\u062F"
  },
  {
    code: "EWS-06",
    titleFa: "\u0628\u0627\u0632\u06CC\u0627\u0641\u062A \u06A9\u0646\u062F \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A",
    kpi: "advance_recovered_pct",
    op: "lt",
    threshold: 30,
    severity: "warning",
    actionFa: "\u0646\u0631\u062E \u06A9\u0633\u0631 \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0627 \u067E\u06CC\u0634\u0631\u0641\u062A \u06A9\u0627\u0631 \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC \u0634\u0648\u062F"
  },
  {
    code: "EWS-07",
    titleFa: "\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u0654 \u0631\u0648 \u0628\u0647 \u0627\u0646\u0642\u0636\u0627",
    kpi: "expiring_guarantee_count",
    op: "gt",
    threshold: 0,
    severity: "critical",
    actionFa: "\u062A\u0645\u062F\u06CC\u062F \u06CC\u0627 \u0636\u0628\u0637 \u067E\u06CC\u0634 \u0627\u0632 \u0633\u0631\u0631\u0633\u06CC\u062F\u061B \u067E\u0633 \u0627\u0632 \u0627\u0646\u0642\u0636\u0627 \u067E\u0648\u0634\u0634 \u0627\u0632 \u0628\u06CC\u0646 \u0645\u06CC\u200C\u0631\u0648\u062F"
  }
];
function evaluateAlerts(input) {
  const overrideBy = /* @__PURE__ */ new Map();
  for (const o of input.overrides ?? []) {
    const code = String(o.RuleCode ?? "").trim();
    if (!code) continue;
    const enabled = !(o.IsEnabled === false || o.IsEnabled === 0 || o.IsEnabled === "0");
    const t = o.ThresholdValue;
    const sev = String(o.Severity ?? "");
    overrideBy.set(code, {
      threshold: t == null || !Number.isFinite(Number(t)) ? void 0 : Number(t),
      severity: ["info", "warning", "critical"].includes(sev) ? sev : void 0,
      enabled
    });
  }
  const rules = input.rules ?? DEFAULT_ALERT_RULES;
  const fired = [];
  const skipped = [];
  for (const rule of rules) {
    const ov = overrideBy.get(rule.code);
    if (ov && !ov.enabled) continue;
    const value = input.kpis.byCode[rule.kpi];
    if (value == null) {
      skipped.push({
        code: rule.code,
        titleFa: rule.titleFa,
        reasonFa: `\u0633\u0646\u062C\u0647\u0654 \xAB${KPI_BY_CODE[rule.kpi]?.titleFa ?? rule.kpi}\xBB \u0645\u062D\u0627\u0633\u0628\u0647\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A`
      });
      continue;
    }
    const threshold = ov?.threshold ?? rule.threshold;
    const severity = ov?.severity ?? rule.severity;
    const hit = rule.op === "gt" ? value > threshold : value < threshold;
    if (!hit) continue;
    const spec = KPI_BY_CODE[rule.kpi];
    fired.push({
      code: rule.code,
      titleFa: rule.titleFa,
      kpi: rule.kpi,
      kpiTitleFa: spec?.titleFa ?? rule.kpi,
      severity,
      severityFa: ALERT_SEVERITY_FA[severity],
      value,
      threshold,
      op: rule.op,
      messageFa: `${spec?.titleFa ?? rule.kpi} \u0628\u0631\u0627\u0628\u0631 ${kpiDisplay(value, spec?.unit ?? "pct")} \u0627\u0633\u062A\u061B \u0622\u0633\u062A\u0627\u0646\u0647 ${kpiDisplay(threshold, spec?.unit ?? "pct")}`,
      actionFa: rule.actionFa
    });
  }
  fired.sort((a, b) => ALERT_SEVERITY_RANK[b.severity] - ALERT_SEVERITY_RANK[a.severity]);
  const criticalCount = fired.filter((f) => f.severity === "critical").length;
  const warningCount = fired.filter((f) => f.severity === "warning").length;
  const topSeverity = fired.length ? fired[0].severity : null;
  const summaryFa = fired.length === 0 ? skipped.length ? `\u0647\u0634\u062F\u0627\u0631\u06CC \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A\u060C \u0648\u0644\u06CC ${skipped.length} \u0642\u0627\u0639\u062F\u0647 \u0628\u0647\u200C\u062F\u0644\u06CC\u0644 \u0646\u0628\u0648\u062F \u062F\u0627\u062F\u0647 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0646\u0634\u062F` : "\u0647\u06CC\u0686 \u0647\u0634\u062F\u0627\u0631\u06CC \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A" : `${criticalCount} \u0628\u062D\u0631\u0627\u0646\u06CC \u0648 ${warningCount} \u0647\u0634\u062F\u0627\u0631 \u0641\u0639\u0627\u0644 \u0627\u0633\u062A`;
  return { fired, criticalCount, warningCount, skipped, topSeverity, summaryFa };
}
var HEALTH_BAND_FA = {
  good: "\u0633\u0627\u0644\u0645",
  watch: "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0645\u0631\u0627\u0642\u0628\u062A",
  poor: "\u0628\u062D\u0631\u0627\u0646\u06CC",
  unknown: "\u0642\u0627\u0628\u0644 \u0633\u0646\u062C\u0634 \u0646\u06CC\u0633\u062A"
};
function normalizeKpi(code, value) {
  switch (code) {
    case "progress_gap_pct": {
      const g = value;
      const penalty = g > 0 ? g * 4 : Math.abs(g) * 2;
      return Math.max(0, 100 - penalty);
    }
    case "ceiling_used_pct":
      return value <= 75 ? 100 : Math.max(0, 100 - (value - 75) * 4);
    case "advance_recovered_pct":
      return Math.max(0, Math.min(100, value));
    case "extra_work_ratio_pct":
      return Math.max(0, 100 - value / 25 * 100);
    case "avg_ipc_cycle_days":
      return value <= 30 ? 100 : Math.max(0, 100 - (value - 30) / 60 * 100);
    case "expiring_guarantee_count":
      return value <= 0 ? 100 : Math.max(0, 100 - value * 34);
    default:
      return Math.max(0, Math.min(100, value));
  }
}
function contractHealth(input) {
  const minCoverage = input.minCoveragePct ?? 50;
  const scored = CONTRACT_KPI_CATALOG.filter((s) => s.weight > 0);
  const totalWeight = scored.reduce((s, k) => s + k.weight, 0);
  const contributions = [];
  let weighted = 0;
  let covered = 0;
  for (const spec of scored) {
    const value = input.kpis.byCode[spec.code];
    if (value == null) continue;
    const normalized = round(normalizeKpi(spec.code, value), 1);
    weighted += normalized * spec.weight;
    covered += spec.weight;
    contributions.push({
      code: spec.code,
      titleFa: spec.titleFa,
      normalized,
      weight: spec.weight,
      penaltyFa: normalized < 60 ? `${spec.titleFa} \u0646\u0645\u0631\u0647 \u0631\u0627 \u067E\u0627\u06CC\u06CC\u0646 \u06A9\u0634\u06CC\u062F\u0647` : null
    });
  }
  const weightCovered = totalWeight > 0 ? round(covered / totalWeight * 100) : 0;
  if (covered <= 0 || weightCovered < minCoverage) {
    return {
      score: null,
      band: "unknown",
      bandFa: HEALTH_BAND_FA.unknown,
      contributions,
      weightCovered,
      messageFa: `\u062A\u0646\u0647\u0627 ${weightCovered}\u066A \u0627\u0632 \u0648\u0632\u0646 \u0633\u0646\u062C\u0647\u200C\u0647\u0627 \u062F\u0627\u062F\u0647 \u062F\u0627\u0631\u062F\u061B \u0646\u0645\u0631\u0647\u0654 \u0633\u0644\u0627\u0645\u062A \u0628\u0627 \u0627\u06CC\u0646 \u067E\u0648\u0634\u0634 \u06AF\u0645\u0631\u0627\u0647\u200C\u06A9\u0646\u0646\u062F\u0647 \u0627\u0633\u062A`
    };
  }
  const score = round(weighted / covered, 1);
  const band = score >= 75 ? "good" : score >= 50 ? "watch" : "poor";
  const worst = [...contributions].sort((a, b) => a.normalized - b.normalized)[0];
  const messageFa = band === "good" ? "\u0633\u0646\u062C\u0647\u200C\u0647\u0627\u06CC \u067E\u06CC\u0645\u0627\u0646 \u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647\u0654 \u0633\u0627\u0644\u0645 \u0627\u0633\u062A" : `${HEALTH_BAND_FA[band]} \u2014 \u0636\u0639\u06CC\u0641\u200C\u062A\u0631\u06CC\u0646 \u0633\u0646\u062C\u0647: ${worst?.titleFa ?? "\u2014"}`;
  return {
    score,
    band,
    bandFa: HEALTH_BAND_FA[band],
    contributions: contributions.sort((a, b) => a.normalized - b.normalized),
    weightCovered,
    messageFa
  };
}
var TREND_FA = {
  improving: "\u0631\u0648 \u0628\u0647 \u0628\u0647\u0628\u0648\u062F",
  worsening: "\u0631\u0648 \u0628\u0647 \u0628\u062F\u062A\u0631\u0634\u062F\u0646",
  flat: "\u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u0639\u0646\u0627\u062F\u0627\u0631",
  unknown: "\u0642\u0627\u0628\u0644 \u0633\u0646\u062C\u0634 \u0646\u06CC\u0633\u062A"
};
var TREND_NOISE = { pct: 2, days: 3, count: 0.5, amount: 0 };
function kpiTrend(input) {
  const COLUMN_BY_KPI = {
    physical_pct: "PhysicalPct",
    financial_pct: "FinancialPct",
    progress_gap_pct: "VariancePct",
    ceiling_used_pct: "CeilingUsedPct",
    advance_recovered_pct: "AdvanceRecoveredPct",
    extra_work_ratio_pct: "ExtraWorkRatioPct",
    avg_ipc_cycle_days: "AvgIpcCycleDays",
    open_guarantee_count: "OpenGuaranteeCount",
    retainage_balance: "RetainageBalance"
  };
  const sorted = [...input.snapshots ?? []].filter((s) => String(s.PeriodCode ?? "").trim()).sort((a, b) => String(a.PeriodCode).localeCompare(String(b.PeriodCode)));
  const periods = sorted.map((s) => String(s.PeriodCode));
  if (sorted.length < 2) {
    return {
      periods,
      trends: [],
      worsening: [],
      improving: [],
      emergingFa: [],
      summaryFa: sorted.length === 0 ? "\u0647\u06CC\u0686 \u0639\u06A9\u0633 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A" : "\u062A\u0646\u0647\u0627 \u06CC\u06A9 \u062F\u0648\u0631\u0647 \u062B\u0628\u062A \u0634\u062F\u0647\u061B \u0631\u0648\u0646\u062F \u0627\u0632 \u062F\u0648 \u062F\u0648\u0631\u0647 \u0628\u0647 \u0628\u0639\u062F \u0645\u0639\u0646\u0627 \u062F\u0627\u0631\u062F"
    };
  }
  const cur = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const trends = [];
  for (const spec of CONTRACT_KPI_CATALOG) {
    const col = COLUMN_BY_KPI[spec.code];
    if (!col) continue;
    const c = cur[col];
    const p = prev[col];
    const current = c == null || !Number.isFinite(Number(c)) ? null : round(Number(c));
    const previous = p == null || !Number.isFinite(Number(p)) ? null : round(Number(p));
    if (current == null || previous == null) {
      trends.push({
        code: spec.code,
        titleFa: spec.titleFa,
        current,
        previous,
        delta: null,
        direction: "unknown",
        directionFa: TREND_FA.unknown,
        isSignificant: false
      });
      continue;
    }
    const delta = round(current - previous);
    const noise = TREND_NOISE[spec.unit] ?? 0;
    const isSignificant = Math.abs(delta) > noise;
    let direction = "flat";
    if (isSignificant) {
      const better = spec.direction === "lower_better" ? delta < 0 : delta > 0;
      direction = better ? "improving" : "worsening";
    }
    trends.push({
      code: spec.code,
      titleFa: spec.titleFa,
      current,
      previous,
      delta,
      direction,
      directionFa: TREND_FA[direction],
      isSignificant
    });
  }
  const worsening = trends.filter((t) => t.direction === "worsening");
  const improving = trends.filter((t) => t.direction === "improving");
  const emergingFa = [];
  for (const rule of input.rules ?? DEFAULT_ALERT_RULES) {
    const t = trends.find((x) => x.code === rule.kpi);
    if (!t || t.current == null || t.delta == null || t.direction !== "worsening") continue;
    const alreadyFired = rule.op === "gt" ? t.current > rule.threshold : t.current < rule.threshold;
    if (alreadyFired) continue;
    const next = round(t.current + t.delta);
    const willFire = rule.op === "gt" ? next > rule.threshold : next < rule.threshold;
    if (willFire) {
      emergingFa.push(
        `${rule.titleFa}: ${t.titleFa} \u0627\u0632 ${t.previous} \u0628\u0647 ${t.current} \u0631\u0641\u062A\u0647\u061B \u0628\u0627 \u0647\u0645\u06CC\u0646 \u0634\u06CC\u0628 \u062F\u0648\u0631\u0647\u0654 \u0628\u0639\u062F \u0627\u0632 \u0622\u0633\u062A\u0627\u0646\u0647\u0654 ${rule.threshold} \u0631\u062F \u0645\u06CC\u200C\u0634\u0648\u062F`
      );
    }
  }
  const summaryFa = emergingFa.length ? `${emergingFa.length} \u0633\u0646\u062C\u0647 \u062F\u0631 \u0645\u0633\u06CC\u0631 \u0639\u0628\u0648\u0631 \u0627\u0632 \u0622\u0633\u062A\u0627\u0646\u0647 \u0627\u0633\u062A` : worsening.length ? `${worsening.length} \u0633\u0646\u062C\u0647 \u0628\u062F\u062A\u0631 \u0648 ${improving.length} \u0633\u0646\u062C\u0647 \u0628\u0647\u062A\u0631 \u0634\u062F\u0647 \u0627\u0633\u062A` : "\u0631\u0648\u0646\u062F \u0633\u0646\u062C\u0647\u200C\u0647\u0627 \u067E\u0627\u06CC\u062F\u0627\u0631 \u06CC\u0627 \u0631\u0648 \u0628\u0647 \u0628\u0647\u0628\u0648\u062F \u0627\u0633\u062A";
  return { periods, trends, worsening, improving, emergingFa, summaryFa };
}
function contractScorecard(input) {
  const alerts = evaluateAlerts({ kpis: input.kpis, rules: input.rules, overrides: input.overrides });
  const health = contractHealth({ kpis: input.kpis });
  const trend = kpiTrend({ snapshots: input.snapshots ?? [], rules: input.rules });
  const headlineFa = alerts.criticalCount > 0 ? `${alerts.criticalCount} \u0647\u0634\u062F\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC: ${alerts.fired[0].titleFa}` : trend.emergingFa.length > 0 ? trend.emergingFa[0] : alerts.warningCount > 0 ? `${alerts.warningCount} \u0647\u0634\u062F\u0627\u0631 \u0641\u0639\u0627\u0644: ${alerts.fired[0].titleFa}` : health.score == null ? health.messageFa : `\u0646\u0645\u0631\u0647\u0654 \u0633\u0644\u0627\u0645\u062A ${health.score} \u2014 ${health.bandFa}`;
  return {
    contractId: input.contractId ?? null,
    periodCode: input.periodCode ?? null,
    kpis: input.kpis,
    health,
    alerts,
    trend,
    headlineFa
  };
}
var FIN_POSTABLE_STATES = ["approved", "paid"];
var FIN_BLOCK_REASON_FA = {
  not_approved: "\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0647\u0646\u0648\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0647\u0627\u06CC\u06CC \u0646\u0634\u062F\u0647 \u0627\u0633\u062A",
  no_cost_account: "\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u06CC\u0645\u0627\u0646 \u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647 \u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A",
  account_missing: "\u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647\u0654 \u062A\u0639\u06CC\u06CC\u0646\u200C\u0634\u062F\u0647 \u062F\u0631 \u062F\u0641\u062A\u0631 \u0645\u0627\u0644\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F",
  zero_amount: "\u0645\u0628\u0644\u063A \u062E\u0627\u0644\u0635 \u067E\u0631\u062F\u0627\u062E\u062A\u0646\u06CC \u0635\u0641\u0631 \u0627\u0633\u062A",
  cancelled: "\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0628\u0627\u0637\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A",
  already_reversed: "\u0627\u06CC\u0646 \u062B\u0628\u062A \u067E\u06CC\u0634\u200C\u062A\u0631 \u0628\u0631\u06AF\u0634\u062A \u062E\u0648\u0631\u062F\u0647 \u0627\u0633\u062A"
};
function ipcPostability(inp) {
  const ipc = inp.ipc ?? {};
  const state = String(ipc.WorkflowState ?? "");
  const status = String(ipc.Status ?? "");
  const net = num(ipc.NetPayable);
  const code = String(inp.contract?.CostAccountCode ?? "").trim();
  const base = {
    ipcId: String(ipc.Id ?? ""),
    serialNo: Number(ipc.SerialNo) || 0,
    costAccountCode: code || null,
    netAmount: round(net)
  };
  const block = (c) => ({
    ...base,
    isPostable: false,
    blockCode: c,
    blockFa: FIN_BLOCK_REASON_FA[c] ?? c
  });
  if (status === "cancelled") return block("cancelled");
  if (!FIN_POSTABLE_STATES.includes(state)) return block("not_approved");
  if (!code) return block("no_cost_account");
  if (!inp.account) return block("account_missing");
  if (net <= 0) return block("zero_amount");
  return { ...base, isPostable: true, blockCode: null, blockFa: null };
}
function applyPostingToAccount(previousActual, previousShare, newShare) {
  return round(num(previousActual) - num(previousShare) + num(newShare));
}
function buildFinPosting(inp) {
  const ipc = inp.ipc ?? {};
  const acc = inp.account ?? {};
  const prior = inp.prior ?? null;
  const gross = round(num(ipc.SubtotalAmount) || num(ipc.GrossCurrent));
  const net = round(num(ipc.NetPayable));
  const deduction = round(num(ipc.TotalDeductions));
  const vat = round(num(ipc.VatAmount));
  const previousShare = prior && String(prior.Status) === "posted" ? round(num(prior.NetAmount)) : 0;
  const previousActual = round(num(acc.Actual));
  const nextActual = applyPostingToAccount(previousActual, previousShare, net);
  const serial = Number(ipc.SerialNo) || 0;
  const period = String(inp.periodCode ?? ipc.PeriodCode ?? "");
  return {
    ipcId: String(ipc.Id ?? ""),
    serialNo: serial,
    periodCode: period,
    costAccountId: String(acc.Id ?? ""),
    costAccountCode: String(acc.Code ?? ""),
    grossAmount: gross,
    netAmount: net,
    deductionAmount: deduction,
    vatAmount: vat,
    previousShare,
    previousActual,
    nextActual,
    deltaAmount: round(nextActual - previousActual),
    isRepost: previousShare > 0,
    memoFa: `\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A ${toFaDigits(String(serial))} \u067E\u06CC\u0645\u0627\u0646 ${String(inp.contract?.Code ?? "")}` + (period ? ` \u2014 \u062F\u0648\u0631\u0647\u0654 ${period}` : "")
  };
}
function toFaDigits(s) {
  return s.replace(/[0-9]/g, (d) => "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"[Number(d)]);
}
function budgetImpact(line, account) {
  const budget = round(num(account.Budget));
  const prev = round(num(account.Actual));
  const next = line.nextActual;
  const remaining = round(budget - next);
  const usedPct = budget > 0 ? round(next / budget * 100) : null;
  const isOver = budget > 0 && next > budget;
  const wasOver = budget > 0 && prev > budget;
  let warningFa = null;
  if (isOver && !wasOver) {
    warningFa = `\u0627\u06CC\u0646 \u062B\u0628\u062A \u062D\u0633\u0627\u0628 \xAB${String(account.Code ?? "")}\xBB \u0631\u0627 \u0627\u0632 \u0628\u0648\u062F\u062C\u0647 \u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F (\u06A9\u0633\u0631\u06CC ${Math.abs(remaining).toLocaleString("fa-IR")})`;
  } else if (isOver && wasOver) {
    warningFa = `\u062D\u0633\u0627\u0628 \xAB${String(account.Code ?? "")}\xBB \u067E\u06CC\u0634 \u0627\u0632 \u0627\u06CC\u0646 \u062B\u0628\u062A \u0647\u0645 \u0641\u0631\u0627\u062A\u0631 \u0627\u0632 \u0628\u0648\u062F\u062C\u0647 \u0628\u0648\u062F`;
  } else if (usedPct != null && usedPct >= 90) {
    warningFa = `\u0645\u0635\u0631\u0641 \u0628\u0648\u062F\u062C\u0647\u0654 \u062D\u0633\u0627\u0628 \xAB${String(account.Code ?? "")}\xBB \u0628\u0647 ${usedPct}\u066A \u0631\u0633\u06CC\u062F`;
  }
  return {
    costAccountCode: String(account.Code ?? ""),
    budget,
    previousActual: prev,
    nextActual: next,
    remaining,
    usedPct,
    isOverBudget: isOver,
    wasAlreadyOver: wasOver,
    warningFa
  };
}
var RECONCILE_STATE_FA = {
  in_sync: "\u0647\u0645\u0627\u0647\u0646\u06AF",
  not_posted: "\u0627\u0631\u0633\u0627\u0644\u200C\u0646\u0634\u062F\u0647",
  amount_drift: "\u0645\u063A\u0627\u06CC\u0631\u062A \u0645\u0628\u0644\u063A",
  orphan_posting: "\u062B\u0628\u062A \u0628\u06CC\u200C\u0645\u0631\u062C\u0639",
  reversed: "\u0628\u0631\u06AF\u0634\u062A\u200C\u062E\u0648\u0631\u062F\u0647"
};
function reconcileFinPostings(inp) {
  const postings = inp.postings ?? [];
  const byIpc = /* @__PURE__ */ new Map();
  for (const p of postings) byIpc.set(String(p.IpcId ?? ""), p);
  const rows = [];
  const seen = /* @__PURE__ */ new Set();
  for (const ipc of inp.ipcs ?? []) {
    const id = String(ipc.Id ?? "");
    seen.add(id);
    const state = String(ipc.WorkflowState ?? "");
    const status = String(ipc.Status ?? "");
    const net = round(num(ipc.NetPayable));
    const p = byIpc.get(id);
    const isFinal = FIN_POSTABLE_STATES.includes(state) && status !== "cancelled";
    let st;
    let posted = null;
    let drift = 0;
    if (!p) {
      if (!isFinal) continue;
      st = "not_posted";
    } else if (String(p.Status) === "reversed") {
      posted = round(num(p.NetAmount));
      st = isFinal ? "not_posted" : "reversed";
    } else {
      posted = round(num(p.NetAmount));
      drift = round(net - posted);
      st = drift === 0 ? "in_sync" : "amount_drift";
    }
    rows.push({
      ipcId: id,
      serialNo: Number(ipc.SerialNo) || 0,
      periodCode: String(ipc.PeriodCode ?? ""),
      workflowState: state,
      netAmount: net,
      postedAmount: posted,
      state: st,
      stateFa: RECONCILE_STATE_FA[st] ?? st,
      driftAmount: drift,
      needsActionFa: st === "not_posted" ? "\u0627\u0631\u0633\u0627\u0644 \u0628\u0647 \u0645\u0627\u0644\u06CC" : st === "amount_drift" ? "\u0627\u0631\u0633\u0627\u0644 \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0631\u0627\u06CC \u0647\u0645\u200C\u062A\u0631\u0627\u0632\u06CC \u0645\u0628\u0644\u063A" : null
    });
  }
  for (const p of postings) {
    const id = String(p.IpcId ?? "");
    if (seen.has(id)) continue;
    if (String(p.Status) === "reversed") continue;
    rows.push({
      ipcId: id,
      serialNo: Number(p.SerialNo) || 0,
      periodCode: String(p.PeriodCode ?? ""),
      workflowState: "\u2014",
      netAmount: 0,
      postedAmount: round(num(p.NetAmount)),
      state: "orphan_posting",
      stateFa: RECONCILE_STATE_FA.orphan_posting,
      driftAmount: round(-num(p.NetAmount)),
      needsActionFa: "\u0628\u0631\u0631\u0633\u06CC \u0648 \u062F\u0631 \u0635\u0648\u0631\u062A \u0644\u0632\u0648\u0645 \u0628\u0631\u06AF\u0634\u062A \u062B\u0628\u062A"
    });
  }
  rows.sort((a, b) => {
    const rank = { amount_drift: 0, orphan_posting: 1, not_posted: 2, reversed: 3, in_sync: 4 };
    const d = (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
    return d !== 0 ? d : a.serialNo - b.serialNo;
  });
  const count = (s) => rows.filter((r) => r.state === s).length;
  const notPosted = count("not_posted");
  const drifted = count("amount_drift");
  const orphan = count("orphan_posting");
  const notPostedAmount = round(rows.filter((r) => r.state === "not_posted").reduce((s, r) => s + r.netAmount, 0));
  const driftAmount = round(rows.filter((r) => r.state === "amount_drift").reduce((s, r) => s + Math.abs(r.driftAmount), 0));
  const warningsFa = [];
  if (drifted > 0) {
    warningsFa.push(`${drifted} \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u067E\u0633 \u0627\u0632 \u0627\u0631\u0633\u0627\u0644 \u0627\u0635\u0644\u0627\u062D \u0634\u062F\u0647 \u0648 \u062F\u0648 \u062F\u0641\u062A\u0631 \u06CC\u06A9 \u0639\u062F\u062F \u0646\u0645\u06CC\u200C\u06AF\u0648\u06CC\u0646\u062F`);
  }
  if (orphan > 0) {
    warningsFa.push(`${orphan} \u062B\u0628\u062A \u0645\u0627\u0644\u06CC \u0628\u062F\u0648\u0646 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0645\u0639\u062A\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0634\u062F`);
  }
  if (notPosted > 0) {
    warningsFa.push(`${notPosted} \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0647\u0646\u0648\u0632 \u0628\u0647 \u0645\u0627\u0644\u06CC \u0646\u0631\u0641\u062A\u0647 (${notPostedAmount.toLocaleString("fa-IR")} \u0631\u06CC\u0627\u0644 \u062A\u0639\u0647\u062F \u062B\u0628\u062A\u200C\u0646\u0634\u062F\u0647)`);
  }
  return {
    rows,
    summary: {
      total: rows.length,
      inSync: count("in_sync"),
      notPosted,
      amountDrift: drifted,
      orphan,
      reversed: count("reversed"),
      notPostedAmount,
      driftAmount,
      isClean: drifted === 0 && orphan === 0 && notPosted === 0
    },
    warningsFa
  };
}
function contractFinSummary(inp) {
  const c = inp.contract ?? {};
  const active = (inp.postings ?? []).filter((p) => String(p.Status) === "posted");
  const approved = (inp.ipcs ?? []).filter((i) => FIN_POSTABLE_STATES.includes(String(i.WorkflowState ?? "")) && String(i.Status) !== "cancelled");
  const postedNet = round(active.reduce((s, p) => s + num(p.NetAmount), 0));
  const approvedGross = round(approved.reduce((s, i) => s + (num(i.SubtotalAmount) || num(i.GrossCurrent)), 0));
  const amount = round(num(c.CurrentAmount) || num(c.InitialAmount));
  const withheld = round(approvedGross - postedNet);
  const postedIds = new Set(active.map((p) => String(p.IpcId)));
  const pending = approved.filter((i) => !postedIds.has(String(i.Id))).length;
  const notesFa = [];
  if (withheld > 0) {
    notesFa.push(`${withheld.toLocaleString("fa-IR")} \u0631\u06CC\u0627\u0644 \u06A9\u0633\u0648\u0631 (\u0633\u067E\u0631\u062F\u0647\u060C \u067E\u06CC\u0634\u200C\u067E\u0631\u062F\u0627\u062E\u062A\u060C \u0645\u0627\u0644\u06CC\u0627\u062A) \u062F\u0631 \u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647 \u0646\u0646\u0634\u0633\u062A\u0647 \u0686\u0648\u0646 \u0647\u0646\u0648\u0632 \u067E\u0648\u0644 \u067E\u0631\u0648\u0698\u0647 \u0627\u0633\u062A`);
  }
  if (pending > 0) {
    notesFa.push(`${pending} \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0647\u0646\u0648\u0632 \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062F\u0647`);
  }
  if (!String(c.CostAccountCode ?? "").trim()) {
    notesFa.push("\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u06CC\u0645\u0627\u0646 \u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647 \u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u0647 \u0648 \u0647\u06CC\u0686 \u0639\u062F\u062F\u06CC \u0628\u0647 \u0645\u0627\u0644\u06CC \u0646\u0645\u06CC\u200C\u0631\u0633\u062F");
  }
  return {
    contractId: String(c.Id ?? ""),
    contractCode: String(c.Code ?? ""),
    costAccountCode: String(c.CostAccountCode ?? "").trim() || null,
    contractAmount: amount,
    postedNet,
    approvedGross,
    withheldAmount: withheld,
    postedCount: active.length,
    pendingCount: pending,
    remainingCommitment: round(amount - approvedGross),
    commitmentUsedPct: amount > 0 ? round(approvedGross / amount * 100) : null,
    notesFa
  };
}
var CNT_REPORT_CATALOG = [
  {
    code: "RPT-CNT-IPC",
    title: { fa: "\u0628\u0631\u06AF\u0647 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0645\u0648\u0642\u062A", en: "Interim payment certificate" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "\u0633\u0646\u062F \u0631\u0633\u0645\u06CC \u0645\u0637\u0627\u0644\u0628\u0647: \u0631\u06CC\u0632\u0645\u062A\u0631\u0647\u060C \u06A9\u0633\u0648\u0631 \u0648 \u0645\u0628\u0644\u063A \u062E\u0627\u0644\u0635 \u0628\u0627 \u062C\u0627\u06CC \u0627\u0645\u0636\u0627\u06CC \u0633\u0647 \u0637\u0631\u0641",
      en: "formal claim document with line items, deductions and three-party signature"
    }
  },
  {
    code: "RPT-CNT-BOQ",
    title: { fa: "\u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627 \u0648 \u067E\u06CC\u0634\u0631\u0641\u062A \u0631\u062F\u06CC\u0641\u200C\u0647\u0627", en: "BOQ and line progress" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "\u0645\u0642\u062F\u0627\u0631 \u067E\u06CC\u0645\u0627\u0646\u06CC\u060C \u0627\u062C\u0631\u0627\u0634\u062F\u0647 \u0648 \u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647 \u0647\u0631 \u0631\u062F\u06CC\u0641 \u0628\u0627 \u062F\u0631\u0635\u062F \u062A\u062D\u0642\u0642",
      en: "contract, executed and remaining quantity per line"
    }
  },
  {
    code: "RPT-CNT-PRG",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u067E\u06CC\u0634\u0631\u0641\u062A \u067E\u06CC\u0645\u0627\u0646", en: "Contract progress report" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0641\u06CC\u0632\u06CC\u06A9\u06CC \u0648 \u0645\u0627\u0644\u06CC\u060C \u0641\u0627\u0635\u0644\u0647\u0654 \u0628\u06CC\u0646\u200C\u0634\u0627\u0646 \u0648 \u0645\u0646\u062D\u0646\u06CC S",
      en: "physical vs financial progress with gap and S-curve"
    }
  },
  {
    code: "RPT-CNT-GRT",
    title: { fa: "\u062F\u0641\u062A\u0631 \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u200C\u0647\u0627", en: "Guarantee register" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "\u0648\u062B\u06CC\u0642\u0647\u200C\u0647\u0627\u06CC \u062F\u0631 \u062C\u0631\u06CC\u0627\u0646\u060C \u0633\u0631\u0631\u0633\u06CC\u062F \u0648 \u067E\u0648\u0634\u0634\u200C\u0633\u0646\u062C\u06CC",
      en: "active guarantees, expiry and coverage"
    }
  },
  {
    code: "RPT-CNT-DED",
    title: { fa: "\u0635\u0648\u0631\u062A \u06A9\u0633\u0648\u0631 \u0648 \u0633\u067E\u0631\u062F\u0647", en: "Deductions and retainage statement" },
    periodicity: "monthly",
    audiences: ["internal", "official"],
    purpose: {
      fa: "\u062A\u0641\u06A9\u06CC\u06A9 \u06A9\u0633\u0648\u0631 \u0642\u0627\u0646\u0648\u0646\u06CC \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC \u0628\u0627 \u0645\u0627\u0646\u062F\u0647\u0654 \u0633\u067E\u0631\u062F\u0647\u0654 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u06A9\u0627\u0631",
      en: "statutory and contractual deductions with retainage balance"
    }
  },
  {
    code: "RPT-CNT-SUB",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u0627\u0646 \u062C\u0632\u0621", en: "Subcontractor report" },
    periodicity: "monthly",
    /* فقط داخلی: رابطهٔ مالی با جزء به کارفرما مربوط نیست و افشایش
     * موضع چانه‌زنی را تضعیف می‌کند. */
    audiences: ["internal"],
    purpose: {
      fa: "\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u062C\u0632\u0621\u060C \u062A\u0637\u0628\u06CC\u0642 \u0628\u0627 \u067E\u06CC\u0645\u0627\u0646 \u0627\u0635\u0644\u06CC \u0648 \u0645\u0628\u0644\u063A \u062E\u0627\u0644\u0635 \u067E\u0631\u062F\u0627\u062E\u062A\u0646\u06CC",
      en: "sub IPCs, back-to-back check and net payable"
    }
  },
  {
    code: "RPT-CNT-FIN",
    title: { fa: "\u062A\u0637\u0628\u06CC\u0642 \u067E\u06CC\u0645\u0627\u0646 \u0628\u0627 \u062F\u0641\u062A\u0631 \u0645\u0627\u0644\u06CC", en: "Contract-finance reconciliation" },
    periodicity: "monthly",
    /* فقط داخلی: مغایرت دفاتر مسئلهٔ کنترل داخلی است، نه سند رسمی. */
    audiences: ["internal"],
    purpose: {
      fa: "\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A\u200C\u0647\u0627\u06CC \u0627\u0631\u0633\u0627\u0644\u200C\u0646\u0634\u062F\u0647 \u0648 \u0645\u063A\u0627\u06CC\u0631\u062A \u0645\u0628\u0644\u063A \u0628\u06CC\u0646 \u062F\u0648 \u062F\u0641\u062A\u0631",
      en: "unposted certificates and amount drift between ledgers"
    }
  },
  {
    code: "RPT-CNT-EXEC",
    title: { fa: "\u06AF\u0632\u0627\u0631\u0634 \u062A\u06A9\u200C\u0635\u0641\u062D\u0647\u200C\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u067E\u06CC\u0645\u0627\u0646", en: "Contract executive summary" },
    periodicity: "monthly",
    /* فقط داخلی: نمرهٔ سلامت و هشدار زودهنگام قضاوت درونی‌اند. */
    audiences: ["internal"],
    purpose: {
      fa: "\u06CC\u06A9 \u0635\u0641\u062D\u0647 \u0628\u0631\u0627\u06CC \u062A\u0635\u0645\u06CC\u0645\u200C\u06AF\u06CC\u0631 \u0627\u0631\u0634\u062F: \u0646\u0645\u0631\u0647\u0654 \u0633\u0644\u0627\u0645\u062A\u060C \u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0628\u062D\u0631\u0627\u0646\u06CC \u0648 \u0633\u0647 \u0642\u0644\u0645 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0635\u0645\u06CC\u0645",
      en: "one page for executives: health score, critical alerts, top decisions"
    }
  }
];
var CNT_REPORT_BY_CODE = new Map(CNT_REPORT_CATALOG.map((r) => [r.code, r]));
function getCntReport(code) {
  return CNT_REPORT_BY_CODE.get(code);
}
function isCntAudienceAllowed(code, audience) {
  const def = CNT_REPORT_BY_CODE.get(code);
  return !!def && def.audiences.includes(audience);
}
function cell(v) {
  if (v == null || v === "") return "\u2014";
  return typeof v === "number" ? v : String(v);
}
function pct(v) {
  return v == null ? "\u2014" : `${round(num(v), 1)}`;
}
function dedTypeFa(k) {
  return DEDUCTION_TYPE_FA[k] ?? k;
}
function buildIpcSheet(inp) {
  const ipc = inp.ipc ?? {};
  const c = inp.contract ?? {};
  const lines = inp.ipcLines ?? [];
  const deds = inp.deductions ?? [];
  const boqById = new Map((inp.boq ?? []).map((b) => [String(b.Id), b]));
  return [
    {
      kind: "kpi",
      title: { fa: "\u062E\u0644\u0627\u0635\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", en: "Certificate summary" },
      cells: [
        { label: { fa: "\u0634\u0645\u0627\u0631\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", en: "Serial" }, value: String(cell(ipc.SerialNo)) },
        { label: { fa: "\u062F\u0648\u0631\u0647", en: "Period" }, value: String(cell(ipc.PeriodCode)) },
        { label: { fa: "\u0646\u0627\u062E\u0627\u0644\u0635 \u062F\u0648\u0631\u0647", en: "Gross current" }, value: String(cell(round(num(ipc.GrossCurrent)))) },
        { label: { fa: "\u0646\u0627\u062E\u0627\u0644\u0635 \u062A\u062C\u0645\u0639\u06CC", en: "Gross cumulative" }, value: String(cell(round(num(ipc.GrossCumulative)))) },
        { label: { fa: "\u062C\u0645\u0639 \u06A9\u0633\u0648\u0631", en: "Deductions" }, value: String(cell(round(num(ipc.TotalDeductions)))) },
        { label: { fa: "\u062E\u0627\u0644\u0635 \u067E\u0631\u062F\u0627\u062E\u062A\u0646\u06CC", en: "Net payable" }, value: String(cell(round(num(ipc.NetPayable)))), tone: "good" }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u0631\u06CC\u0632\u0645\u062A\u0631\u0647", en: "Line items" },
      note: {
        fa: "\u0645\u0642\u062F\u0627\u0631 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0645\u0628\u0646\u0627\u06CC \u0645\u0628\u0644\u063A \u0627\u0633\u062A\u060C \u0646\u0647 \u0645\u0642\u062F\u0627\u0631 \u0627\u062F\u0639\u0627\u06CC\u06CC",
        en: "approved quantity is the basis, not claimed"
      },
      columns: [
        { key: "itemNo", title: { fa: "\u0631\u062F\u06CC\u0641", en: "Item" }, weight: 1 },
        { key: "titleFa", title: { fa: "\u0634\u0631\u062D", en: "Description" }, weight: 4 },
        { key: "unit", title: { fa: "\u0648\u0627\u062D\u062F", en: "Unit" }, weight: 1 },
        { key: "rate", title: { fa: "\u0628\u0647\u0627\u06CC \u0648\u0627\u062D\u062F", en: "Rate" }, format: "currency", align: "end", weight: 2 },
        { key: "prevQty", title: { fa: "\u0642\u0628\u0644\u06CC", en: "Previous" }, format: "number", align: "end", weight: 1 },
        { key: "currentQty", title: { fa: "\u0627\u06CC\u0646 \u062F\u0648\u0631\u0647", en: "Current" }, format: "number", align: "end", weight: 1 },
        { key: "cumQty", title: { fa: "\u062A\u062C\u0645\u0639\u06CC", en: "Cumulative" }, format: "number", align: "end", weight: 1 },
        { key: "earned", title: { fa: "\u0645\u0628\u0644\u063A \u062F\u0648\u0631\u0647", en: "Amount" }, format: "currency", align: "end", weight: 2 }
      ],
      rows: lines.map((l) => {
        const b = boqById.get(String(l.BoqItemId));
        return {
          itemNo: cell(b?.ItemNo),
          titleFa: cell(b?.TitleFa),
          unit: cell(b?.Unit),
          rate: cell(round(num(l.UnitRate) || num(b?.UnitRate))),
          prevQty: cell(num(l.PrevQty)),
          currentQty: cell(num(l.CurrentQty)),
          cumQty: cell(num(l.CumQty)),
          earned: cell(round(num(l.EarnedCurrent)))
        };
      })
    },
    {
      kind: "table",
      title: { fa: "\u06A9\u0633\u0648\u0631", en: "Deductions" },
      note: {
        fa: "\u06A9\u0633\u0648\u0631 \u0642\u0627\u0646\u0648\u0646\u06CC \u0627\u0632 \u06A9\u0633\u0648\u0631 \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC \u062C\u062F\u0627 \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F",
        en: "statutory and contractual deductions are separated"
      },
      columns: [
        { key: "type", title: { fa: "\u0646\u0648\u0639", en: "Type" }, weight: 3 },
        { key: "base", title: { fa: "\u0645\u0623\u062E\u0630", en: "Base" }, format: "currency", align: "end", weight: 2 },
        { key: "rate", title: { fa: "\u0646\u0631\u062E", en: "Rate" }, format: "percent", align: "end", weight: 1 },
        { key: "amount", title: { fa: "\u0645\u0628\u0644\u063A", en: "Amount" }, format: "currency", align: "end", weight: 2 },
        { key: "statutory", title: { fa: "\u0642\u0627\u0646\u0648\u0646\u06CC", en: "Statutory" }, align: "center", weight: 1 }
      ],
      rows: deds.map((d) => ({
        type: cell(dedTypeFa(String(d.DeductionType))),
        base: cell(round(num(d.BaseAmount))),
        rate: cell(num(d.RatePct)),
        amount: cell(round(num(d.Amount))),
        statutory: d.IsStatutory === true || d.IsStatutory === 1 || d.IsStatutory === "1" ? "\u0628\u0644\u0647" : "\u062E\u06CC\u0631"
      }))
    },
    {
      kind: "text",
      title: { fa: "\u062A\u0623\u06CC\u06CC\u062F\u0647\u0627", en: "Approvals" },
      body: {
        fa: `\u062A\u0647\u06CC\u0647: ${String(c.ContractorName ?? "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631")} \xB7 \u062A\u0623\u06CC\u06CC\u062F \u0641\u0646\u06CC: ${String(c.ConsultantName ?? "\u0645\u0634\u0627\u0648\u0631")} \xB7 \u062A\u0635\u0648\u06CC\u0628: ${String(c.EmployerName ?? "\u06A9\u0627\u0631\u0641\u0631\u0645\u0627")}`,
        en: "Prepared by contractor, verified by consultant, approved by employer"
      }
    }
  ];
}
function buildBoqSheet(inp) {
  const boq = inp.boq ?? [];
  const lines = inp.ipcLines ?? [];
  const cumByItem = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const k = String(l.BoqItemId);
    const v = num(l.CumQty);
    if (!cumByItem.has(k) || v > (cumByItem.get(k) ?? 0)) cumByItem.set(k, v);
  }
  const rows = boq.map((b) => {
    const contractQty = num(b.ContractQty);
    const done = cumByItem.get(String(b.Id)) ?? 0;
    const rate = num(b.UnitRate);
    return {
      itemNo: cell(b.ItemNo),
      titleFa: cell(b.TitleFa),
      unit: cell(b.Unit),
      rate: cell(round(rate)),
      contractQty: cell(contractQty),
      doneQty: cell(round(done, 3)),
      remainQty: cell(round(contractQty - done, 3)),
      donePct: contractQty > 0 ? pct(done / contractQty * 100) : "\u2014",
      amount: cell(round(num(b.LineAmount) || contractQty * rate)),
      starred: b.IsStarred === true || b.IsStarred === 1 || b.IsStarred === "1" ? "\u2605" : ""
    };
  });
  const totalAmount = round(boq.reduce((s, b) => s + (num(b.LineAmount) || num(b.ContractQty) * num(b.UnitRate)), 0));
  return [
    {
      kind: "kpi",
      title: { fa: "\u062C\u0645\u0639 \u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627", en: "BOQ totals" },
      cells: [
        { label: { fa: "\u062A\u0639\u062F\u0627\u062F \u0631\u062F\u06CC\u0641", en: "Line count" }, value: String(boq.length) },
        { label: { fa: "\u062C\u0645\u0639 \u0645\u0628\u0644\u063A", en: "Total amount" }, value: String(totalAmount) },
        {
          label: { fa: "\u0631\u062F\u06CC\u0641 \u0633\u062A\u0627\u0631\u0647\u200C\u062F\u0627\u0631", en: "Starred lines" },
          value: String(boq.filter((b) => b.IsStarred === true || b.IsStarred === 1 || b.IsStarred === "1").length)
        }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u0631\u062F\u06CC\u0641\u200C\u0647\u0627\u06CC \u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627", en: "BOQ lines" },
      note: {
        fa: "\u0633\u062A\u0627\u0631\u0647 \u06CC\u0639\u0646\u06CC \u0631\u062F\u06CC\u0641 \u062E\u0627\u0631\u062C \u0627\u0632 \u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627\u06CC \u067E\u0627\u06CC\u0647 (\u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F)",
        en: "star marks non-schedule (extra work) items"
      },
      columns: [
        { key: "starred", title: { fa: "", en: "" }, align: "center", weight: 1 },
        { key: "itemNo", title: { fa: "\u0631\u062F\u06CC\u0641", en: "Item" }, weight: 1 },
        { key: "titleFa", title: { fa: "\u0634\u0631\u062D", en: "Description" }, weight: 4 },
        { key: "unit", title: { fa: "\u0648\u0627\u062D\u062F", en: "Unit" }, weight: 1 },
        { key: "rate", title: { fa: "\u0628\u0647\u0627\u06CC \u0648\u0627\u062D\u062F", en: "Rate" }, format: "currency", align: "end", weight: 2 },
        { key: "contractQty", title: { fa: "\u0645\u0642\u062F\u0627\u0631 \u067E\u06CC\u0645\u0627\u0646", en: "Contract" }, format: "number", align: "end", weight: 1 },
        { key: "doneQty", title: { fa: "\u0627\u062C\u0631\u0627\u0634\u062F\u0647", en: "Executed" }, format: "number", align: "end", weight: 1 },
        { key: "remainQty", title: { fa: "\u0628\u0627\u0642\u06CC", en: "Remaining" }, format: "number", align: "end", weight: 1 },
        { key: "donePct", title: { fa: "\u066A", en: "%" }, format: "percent", align: "end", weight: 1 },
        { key: "amount", title: { fa: "\u0645\u0628\u0644\u063A \u0631\u062F\u06CC\u0641", en: "Amount" }, format: "currency", align: "end", weight: 2 }
      ],
      rows
    }
  ];
}
function buildProgressSheet(inp) {
  const p = inp.progress ?? {};
  const curve = inp.sCurve ?? [];
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A", en: "Progress" },
      cells: [
        { label: { fa: "\u0641\u06CC\u0632\u06CC\u06A9\u06CC", en: "Physical" }, value: pct(p.physicalPct) },
        { label: { fa: "\u0645\u0627\u0644\u06CC", en: "Financial" }, value: pct(p.financialPct) },
        {
          label: { fa: "\u0641\u0627\u0635\u0644\u0647", en: "Gap" },
          value: pct(p.gapPct),
          tone: num(p.gapPct) > 5 ? "bad" : num(p.gapPct) < -5 ? "warn" : "good"
        },
        { label: { fa: "\u0645\u0635\u0631\u0641 \u0633\u0642\u0641", en: "Ceiling used" }, value: pct(p.ceilingUsedPct) }
      ]
    }
  ];
  if (p.isGapReliable === false) {
    sections.push({
      kind: "text",
      title: { fa: "\u0647\u0634\u062F\u0627\u0631 \u06A9\u06CC\u0641\u06CC\u062A \u062F\u0627\u062F\u0647", en: "Data quality warning" },
      body: {
        fa: `\u0641\u0647\u0631\u0633\u062A \u0628\u0647\u0627 ${pct(p.boqCoveragePct)}\u066A \u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646 \u0631\u0627 \u067E\u0648\u0634\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F\u061B \u0641\u0627\u0635\u0644\u0647\u0654 \u0641\u06CC\u0632\u06CC\u06A9\u06CC \u0648 \u0645\u0627\u0644\u06CC \u0631\u0648\u06CC \u062F\u0648 \u0645\u062E\u0631\u062C \u0646\u0627\u0647\u0645\u062E\u0648\u0627\u0646 \u0633\u0646\u062C\u06CC\u062F\u0647 \u0634\u062F\u0647 \u0648 \u0642\u0627\u0628\u0644 \u0627\u062A\u06A9\u0627 \u0646\u06CC\u0633\u062A`,
        en: "BOQ does not cover the contract amount; the progress gap is not reliable"
      }
    });
  }
  if (curve.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "\u0645\u0646\u062D\u0646\u06CC \u067E\u06CC\u0634\u0631\u0641\u062A", en: "Progress curve" },
      note: {
        fa: "\u062F\u0648\u0631\u0647\u0654 \u067E\u0633 \u0627\u0632 \u0622\u062E\u0631\u06CC\u0646 \u062F\u0627\u062F\u0647 \u0648\u0627\u0642\u0639\u06CC\u060C \u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC \u0627\u0633\u062A \u0646\u0647 \u0648\u0627\u0642\u0639\u06CC\u062A",
        en: "periods after the last actual are forecast"
      },
      columns: [
        { key: "period", title: { fa: "\u062F\u0648\u0631\u0647", en: "Period" }, weight: 2 },
        { key: "physical", title: { fa: "\u0641\u06CC\u0632\u06CC\u06A9\u06CC \u066A", en: "Physical %" }, format: "percent", align: "end", weight: 1 },
        { key: "financial", title: { fa: "\u0645\u0627\u0644\u06CC \u066A", en: "Financial %" }, format: "percent", align: "end", weight: 1 },
        { key: "kind", title: { fa: "\u0646\u0648\u0639", en: "Type" }, align: "center", weight: 1 }
      ],
      rows: curve.map((s) => ({
        period: cell(s.periodCode),
        physical: pct(s.physicalPct),
        financial: pct(s.financialPct),
        kind: s.isForecast ? "\u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC" : "\u0648\u0627\u0642\u0639\u06CC"
      }))
    });
  }
  return sections;
}
function buildGuaranteeSheet(inp) {
  const gs = inp.guarantees ?? [];
  const active = gs.filter((g) => String(g.Status) === "active");
  return [
    {
      kind: "kpi",
      title: { fa: "\u0648\u062B\u06CC\u0642\u0647\u200C\u0647\u0627", en: "Guarantees" },
      cells: [
        { label: { fa: "\u062F\u0631 \u062C\u0631\u06CC\u0627\u0646", en: "Active" }, value: String(active.length) },
        {
          label: { fa: "\u062C\u0645\u0639 \u0645\u0628\u0644\u063A \u062F\u0631 \u062C\u0631\u06CC\u0627\u0646", en: "Active amount" },
          value: String(round(active.reduce((s, g) => s + num(g.Amount), 0)))
        },
        { label: { fa: "\u0622\u0632\u0627\u062F\u0634\u062F\u0647", en: "Released" }, value: String(gs.filter((g) => String(g.Status) === "released").length) }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u062F\u0641\u062A\u0631 \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647", en: "Guarantee register" },
      columns: [
        { key: "type", title: { fa: "\u0646\u0648\u0639", en: "Type" }, weight: 2 },
        { key: "no", title: { fa: "\u0634\u0645\u0627\u0631\u0647", en: "Number" }, weight: 2 },
        { key: "bank", title: { fa: "\u0628\u0627\u0646\u06A9", en: "Bank" }, weight: 2 },
        { key: "amount", title: { fa: "\u0645\u0628\u0644\u063A", en: "Amount" }, format: "currency", align: "end", weight: 2 },
        { key: "issue", title: { fa: "\u0635\u062F\u0648\u0631", en: "Issued" }, format: "date", weight: 2 },
        { key: "expiry", title: { fa: "\u0633\u0631\u0631\u0633\u06CC\u062F", en: "Expiry" }, format: "date", weight: 2 },
        { key: "status", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "Status" }, weight: 2 }
      ],
      rows: gs.map((g) => ({
        type: cell(GUARANTEE_TYPE_FA[String(g.GuaranteeType)] ?? g.GuaranteeType),
        no: cell(g.GuaranteeNo),
        bank: cell(g.BankName),
        amount: cell(round(num(g.Amount))),
        issue: cell(g.IssueDate),
        expiry: cell(g.ExpiryDate),
        status: cell(g.Status)
      }))
    }
  ];
}
function buildDeductionSheet(inp) {
  const deds = inp.deductions ?? [];
  const byType = /* @__PURE__ */ new Map();
  for (const d of deds) {
    const k = String(d.DeductionType);
    const cur = byType.get(k) ?? { amount: 0, count: 0, statutory: false };
    cur.amount = round(cur.amount + num(d.Amount));
    cur.count += 1;
    cur.statutory = cur.statutory || d.IsStatutory === true || d.IsStatutory === 1 || d.IsStatutory === "1";
    byType.set(k, cur);
  }
  const retainage = byType.get("retainage")?.amount ?? 0;
  const total = round([...byType.values()].reduce((s, v) => s + v.amount, 0));
  return [
    {
      kind: "kpi",
      title: { fa: "\u062C\u0645\u0639 \u06A9\u0633\u0648\u0631", en: "Deduction totals" },
      cells: [
        { label: { fa: "\u062C\u0645\u0639 \u06A9\u0644", en: "Total" }, value: String(total) },
        { label: { fa: "\u0633\u067E\u0631\u062F\u0647\u0654 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u06A9\u0627\u0631", en: "Retainage" }, value: String(round(retainage)) },
        {
          label: { fa: "\u06A9\u0633\u0648\u0631 \u0642\u0627\u0646\u0648\u0646\u06CC", en: "Statutory" },
          value: String(round([...byType.entries()].filter(([, v]) => v.statutory).reduce((s, [, v]) => s + v.amount, 0)))
        }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u062A\u0641\u06A9\u06CC\u06A9 \u06A9\u0633\u0648\u0631", en: "Deduction breakdown" },
      note: {
        fa: "\u0633\u067E\u0631\u062F\u0647\u0654 \u062D\u0633\u0646 \u0627\u0646\u062C\u0627\u0645 \u06A9\u0627\u0631 \u067E\u0648\u0644 \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u0627\u0633\u062A \u06A9\u0647 \u0646\u0632\u062F \u06A9\u0627\u0631\u0641\u0631\u0645\u0627 \u0627\u0645\u0627\u0646\u062A \u0645\u06CC\u200C\u0645\u0627\u0646\u062F\u060C \u0646\u0647 \u0647\u0632\u06CC\u0646\u0647\u0654 \u067E\u0631\u0648\u0698\u0647",
        en: "retainage is contractor money held in trust, not project cost"
      },
      columns: [
        { key: "type", title: { fa: "\u0646\u0648\u0639 \u06A9\u0633\u0631", en: "Type" }, weight: 3 },
        { key: "count", title: { fa: "\u062F\u0641\u0639\u0627\u062A", en: "Count" }, format: "number", align: "end", weight: 1 },
        { key: "amount", title: { fa: "\u062C\u0645\u0639 \u0645\u0628\u0644\u063A", en: "Amount" }, format: "currency", align: "end", weight: 2 },
        { key: "statutory", title: { fa: "\u0642\u0627\u0646\u0648\u0646\u06CC", en: "Statutory" }, align: "center", weight: 1 }
      ],
      rows: [...byType.entries()].map(([k, v]) => ({
        type: cell(dedTypeFa(k)),
        count: v.count,
        amount: v.amount,
        statutory: v.statutory ? "\u0628\u0644\u0647" : "\u062E\u06CC\u0631"
      }))
    }
  ];
}
function buildSubSheet(inp) {
  const subs = inp.subIpcs ?? [];
  return [
    {
      kind: "kpi",
      title: { fa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u0627\u0646 \u062C\u0632\u0621", en: "Subcontractors" },
      cells: [
        { label: { fa: "\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u062C\u0632\u0621", en: "Sub IPCs" }, value: String(subs.length) },
        {
          label: { fa: "\u062C\u0645\u0639 \u062E\u0627\u0644\u0635", en: "Net total" },
          value: String(round(subs.reduce((s, x) => s + num(x.NetPayable), 0)))
        },
        {
          label: { fa: "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647", en: "Approved" },
          value: String(subs.filter((x) => ["approved", "paid"].includes(String(x.WorkflowState))).length)
        }
      ]
    },
    {
      kind: "table",
      title: { fa: "\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631\u0627\u0646 \u062C\u0632\u0621", en: "Subcontractor certificates" },
      columns: [
        { key: "sub", title: { fa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631 \u062C\u0632\u0621", en: "Subcontractor" }, weight: 3 },
        { key: "serial", title: { fa: "\u0634\u0645\u0627\u0631\u0647", en: "Serial" }, format: "number", align: "end", weight: 1 },
        { key: "period", title: { fa: "\u062F\u0648\u0631\u0647", en: "Period" }, weight: 2 },
        { key: "gross", title: { fa: "\u0646\u0627\u062E\u0627\u0644\u0635", en: "Gross" }, format: "currency", align: "end", weight: 2 },
        { key: "net", title: { fa: "\u062E\u0627\u0644\u0635", en: "Net" }, format: "currency", align: "end", weight: 2 },
        { key: "state", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "State" }, weight: 2 }
      ],
      rows: subs.map((x) => ({
        sub: cell(x.SubcontractorName),
        serial: cell(x.SerialNo),
        period: cell(x.PeriodCode),
        gross: cell(round(num(x.GrossAmount))),
        net: cell(round(num(x.NetPayable))),
        state: cell(x.WorkflowState)
      }))
    }
  ];
}
function buildFinSheet(inp) {
  const rec = inp.reconcile ?? {};
  const sm = rec.summary ?? {};
  const rows = rec.rows ?? [];
  const fs = inp.finSummary ?? {};
  const sections = [
    {
      kind: "kpi",
      title: { fa: "\u062A\u0637\u0628\u06CC\u0642 \u062F\u0648 \u062F\u0641\u062A\u0631", en: "Ledger reconciliation" },
      cells: [
        { label: { fa: "\u0647\u0645\u0627\u0647\u0646\u06AF", en: "In sync" }, value: String(cell(sm.inSync)), tone: "good" },
        {
          label: { fa: "\u0627\u0631\u0633\u0627\u0644\u200C\u0646\u0634\u062F\u0647", en: "Not posted" },
          value: String(cell(sm.notPosted)),
          tone: num(sm.notPosted) > 0 ? "warn" : "good"
        },
        {
          label: { fa: "\u0645\u063A\u0627\u06CC\u0631\u062A \u0645\u0628\u0644\u063A", en: "Amount drift" },
          value: String(cell(sm.amountDrift)),
          tone: num(sm.amountDrift) > 0 ? "bad" : "good"
        },
        { label: { fa: "\u062E\u0627\u0644\u0635 \u0627\u0631\u0633\u0627\u0644\u200C\u0634\u062F\u0647", en: "Posted net" }, value: String(cell(round(num(fs.postedNet)))) },
        { label: { fa: "\u06A9\u0633\u0648\u0631 \u0646\u06AF\u0647\u200C\u062F\u0627\u0634\u062A\u0647", en: "Withheld" }, value: String(cell(round(num(fs.withheldAmount)))) }
      ]
    }
  ];
  if (rows.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "\u0631\u062F\u06CC\u0641\u200C\u0647\u0627\u06CC \u062A\u0637\u0628\u06CC\u0642", en: "Reconciliation rows" },
      note: {
        fa: "\u0645\u063A\u0627\u06CC\u0631\u062A \u0645\u0628\u0644\u063A \u062E\u0637\u0631\u0646\u0627\u06A9\u200C\u062A\u0631 \u0627\u0632 \u0627\u0631\u0633\u0627\u0644\u200C\u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u060C \u0686\u0648\u0646 \u0647\u0631 \u062F\u0648 \u062F\u0641\u062A\u0631 \xAB\u062B\u0628\u062A\u200C\u0634\u062F\u0647\xBB \u0628\u0647 \u0646\u0638\u0631 \u0645\u06CC\u200C\u0631\u0633\u0646\u062F",
        en: "amount drift is more dangerous than unposted: both ledgers look settled"
      },
      columns: [
        { key: "serial", title: { fa: "\u0634\u0645\u0627\u0631\u0647", en: "Serial" }, format: "number", align: "end", weight: 1 },
        { key: "period", title: { fa: "\u062F\u0648\u0631\u0647", en: "Period" }, weight: 2 },
        { key: "net", title: { fa: "\u062E\u0627\u0644\u0635 \u067E\u06CC\u0645\u0627\u0646", en: "Contract net" }, format: "currency", align: "end", weight: 2 },
        { key: "posted", title: { fa: "\u062B\u0628\u062A \u0645\u0627\u0644\u06CC", en: "Posted" }, format: "currency", align: "end", weight: 2 },
        { key: "drift", title: { fa: "\u0627\u062E\u062A\u0644\u0627\u0641", en: "Drift" }, format: "currency", align: "end", weight: 2 },
        { key: "state", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "State" }, weight: 2 },
        { key: "action", title: { fa: "\u0627\u0642\u062F\u0627\u0645", en: "Action" }, weight: 3 }
      ],
      rows: rows.map((r) => ({
        serial: cell(r.serialNo),
        period: cell(r.periodCode),
        net: cell(round(num(r.netAmount))),
        posted: r.postedAmount == null ? "\u2014" : round(num(r.postedAmount)),
        drift: cell(round(num(r.driftAmount))),
        state: cell(r.stateFa),
        action: cell(r.needsActionFa)
      }))
    });
  }
  return sections;
}
function buildExecSheet(inp) {
  const card = inp.scorecard ?? {};
  const health = card.health ?? {};
  const alerts = card.alerts ?? {};
  const fired = alerts.fired ?? [];
  const p = inp.progress ?? {};
  const sections = [
    {
      kind: "text",
      title: { fa: "\u0642\u0636\u0627\u0648\u062A \u06A9\u0644\u06CC", en: "Verdict" },
      body: {
        fa: String(card.headlineFa ?? "\u062F\u0627\u062F\u0647\u0654 \u06A9\u0627\u0641\u06CC \u0628\u0631\u0627\u06CC \u0642\u0636\u0627\u0648\u062A \u0646\u06CC\u0633\u062A"),
        en: String(card.headlineFa ?? "insufficient data")
      }
    },
    {
      kind: "kpi",
      title: { fa: "\u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u06A9\u0644\u06CC\u062F\u06CC", en: "Key indicators" },
      cells: [
        {
          label: { fa: "\u0646\u0645\u0631\u0647\u0654 \u0633\u0644\u0627\u0645\u062A", en: "Health score" },
          value: health.score == null ? "\u2014" : String(health.score),
          tone: health.band === "good" ? "good" : health.band === "watch" ? "warn" : "bad"
        },
        { label: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0641\u06CC\u0632\u06CC\u06A9\u06CC", en: "Physical" }, value: pct(p.physicalPct) },
        { label: { fa: "\u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u0627\u0644\u06CC", en: "Financial" }, value: pct(p.financialPct) },
        {
          label: { fa: "\u0647\u0634\u062F\u0627\u0631 \u0628\u062D\u0631\u0627\u0646\u06CC", en: "Critical alerts" },
          value: String(cell(alerts.criticalCount)),
          tone: num(alerts.criticalCount) > 0 ? "bad" : "good"
        }
      ]
    }
  ];
  if (fired.length > 0) {
    sections.push({
      kind: "table",
      title: { fa: "\u0642\u0644\u0645\u200C\u0647\u0627\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0635\u0645\u06CC\u0645", en: "Decisions required" },
      note: {
        fa: "\u0628\u0647 \u062A\u0631\u062A\u06CC\u0628 \u0634\u062F\u062A \u2014 \u0647\u0631 \u0633\u0637\u0631 \u06CC\u06A9 \u0627\u0642\u062F\u0627\u0645 \u0645\u0634\u062E\u0635 \u062F\u0627\u0631\u062F",
        en: "ordered by severity, each with a concrete action"
      },
      columns: [
        { key: "code", title: { fa: "\u06A9\u062F", en: "Code" }, weight: 1 },
        { key: "title", title: { fa: "\u0645\u0648\u0636\u0648\u0639", en: "Subject" }, weight: 3 },
        { key: "severity", title: { fa: "\u0634\u062F\u062A", en: "Severity" }, weight: 1 },
        { key: "message", title: { fa: "\u0648\u0636\u0639\u06CC\u062A", en: "Status" }, weight: 4 },
        { key: "action", title: { fa: "\u0627\u0642\u062F\u0627\u0645", en: "Action" }, weight: 4 }
      ],
      rows: fired.slice(0, 5).map((f) => ({
        code: cell(f.code),
        title: cell(f.titleFa),
        severity: cell(f.severityFa),
        message: cell(f.messageFa),
        action: cell(f.actionFa)
      }))
    });
  }
  const emerging = (card.trend ?? {}).emergingFa;
  if (emerging && emerging.length > 0) {
    sections.push({
      kind: "text",
      title: { fa: "\u062F\u0631 \u0645\u0633\u06CC\u0631 \u0647\u0634\u062F\u0627\u0631", en: "Emerging" },
      body: { fa: emerging.join(" \xB7 "), en: emerging.join(" \xB7 ") }
    });
  }
  return sections;
}
var CNT_REPORT_BUILDERS = {
  "RPT-CNT-IPC": buildIpcSheet,
  "RPT-CNT-BOQ": buildBoqSheet,
  "RPT-CNT-PRG": buildProgressSheet,
  "RPT-CNT-GRT": buildGuaranteeSheet,
  "RPT-CNT-DED": buildDeductionSheet,
  "RPT-CNT-SUB": buildSubSheet,
  "RPT-CNT-FIN": buildFinSheet,
  "RPT-CNT-EXEC": buildExecSheet
};
function buildCntReport(code, inp) {
  const def = CNT_REPORT_BY_CODE.get(code);
  const builder = CNT_REPORT_BUILDERS[code];
  if (!def || !builder) return null;
  const c = inp.contract ?? {};
  const sections = builder(inp);
  const head = {
    kind: "kpi",
    title: { fa: "\u0634\u0646\u0627\u0633\u0647\u0654 \u067E\u06CC\u0645\u0627\u0646", en: "Contract identity" },
    cells: [
      { label: { fa: "\u06A9\u062F \u067E\u06CC\u0645\u0627\u0646", en: "Contract code" }, value: String(cell(c.Code)) },
      { label: { fa: "\u0645\u0648\u0636\u0648\u0639", en: "Subject" }, value: String(cell(c.TitleFa)) },
      { label: { fa: "\u067E\u06CC\u0645\u0627\u0646\u06A9\u0627\u0631", en: "Contractor" }, value: String(cell(c.ContractorName)) },
      { label: { fa: "\u0645\u0628\u0644\u063A \u067E\u06CC\u0645\u0627\u0646", en: "Contract amount" }, value: String(round(num(c.CurrentAmount) || num(c.InitialAmount))) }
    ]
  };
  return {
    code,
    title: def.title,
    periodicity: def.periodicity,
    sourceModule: "d14",
    audiences: def.audiences,
    sections: [head, ...sections],
    periodLabel: inp.periodLabel ?? null,
    asOf: inp.asOf ?? null
  };
}
export {
  ADVANCE_CUSTOMARY_CAP_PCT,
  ADVANCE_DEFAULT_RECOVERY_PCT,
  ADVANCE_STATUSES,
  ADVANCE_STATUS_FA,
  ALERT_SEVERITY_FA,
  ALERT_SEVERITY_RANK,
  BACK_TO_BACK_SOURCES,
  BACK_TO_BACK_SOURCE_FA,
  BACK_TO_BACK_STATUS_FA,
  CERTIFICATE_TYPE_FA,
  CNT_DOMAIN_ID,
  CNT_REPORT_CATALOG,
  CNT_VERSION,
  CONTRACT_KPI_CATALOG,
  CONTRACT_TYPE_FA,
  DEDUCTION_TYPE_FA,
  DEFAULT_ALERT_RULES,
  FIN_BLOCK_REASON_FA,
  FIN_POSTABLE_STATES,
  GUARANTEE_ALERT_DAYS,
  GUARANTEE_ALERT_FA,
  GUARANTEE_CUSTOMARY_PCT,
  GUARANTEE_STATUSES,
  GUARANTEE_STATUS_FA,
  GUARANTEE_TYPES,
  GUARANTEE_TYPE_FA,
  HEALTH_BAND_FA,
  INDEX_STATUS_FA,
  IPC_WORKFLOW_FA,
  KPI_BY_CODE,
  MILESTONE_EFFECTIVE_STATUS,
  MILESTONE_STATUS_FA,
  PRICING_BASIS_FA,
  PROGRESS_GAP_FA,
  PROGRESS_GAP_TOLERANCE_PCT,
  PUNCH_CATEGORY_FA,
  RATE_STATUS_FA,
  RECONCILE_STATE_FA,
  RETAINAGE_ENTRY_FA,
  SUB_IPC_STATES,
  SUB_IPC_STATE_FA,
  SUB_IPC_TRANSITIONS,
  TREND_FA,
  VARIANCE_FLAG_FA,
  adjustmentBatch,
  advanceLedger,
  advanceRecovery,
  applyPostingToAccount,
  backToBackSummary,
  boqLineAmount,
  boqRollup,
  budgetImpact,
  buildCntReport,
  buildFinPosting,
  canActOnGuarantee,
  canTransitionSubIpc,
  certificateGate,
  computeDeductions,
  computeIpc,
  computeIpcLines,
  contractCeiling,
  contractFinSummary,
  contractHealth,
  contractKpis,
  contractScorecard,
  contractSummary,
  cumulativeAdjustment,
  evaluateAlerts,
  extraWorkBillable,
  extraWorkRatio,
  financialProgress,
  findIndex,
  getCntReport,
  guaranteeEffectiveExpiry,
  guaranteeHealth,
  guaranteeRegister,
  guaranteeState,
  ipcCycle,
  ipcNextActions,
  ipcPostability,
  ipcTransition,
  isCntAudienceAllowed,
  isIpcLocked,
  isSubIpcLocked,
  kpiTrend,
  lineAmount,
  lineEarnedValue,
  mappingCoverage,
  materialDiff,
  measurementQuantity,
  measurementTotal,
  milestoneProgress,
  milestoneRollup,
  nextIpcSerial,
  num,
  planRetainageRelease,
  priceAdjustment,
  progressBreakdown,
  progressGap,
  progressSnapshot,
  punchSummary,
  qualityGate,
  reconcileFinPostings,
  retainageBalance,
  round,
  sCurve,
  subIpcLines,
  subIpcRegister,
  subIpcTotals,
  validateAdvanceInput,
  validateBackToBack,
  validateBoq,
  validateBoqItem,
  validateGuaranteeInput,
  warrantyEnd
};
