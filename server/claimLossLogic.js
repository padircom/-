// src/services/claimLoss.ts
var LOSS_ENGINE_VERSION = "claim-loss-v1";
var LOSS_CATEGORIES = [
  { code: "site_running_costs", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0633\u062A\u0645\u0631 \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "Site running costs" },
  { code: "overhead", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627\u0633\u0631\u06CC \u0648 \u0633\u0631\u0628\u0627\u0631", en: "Overhead & head office" },
  { code: "payment_delay", fa: "\u062E\u0633\u0627\u0631\u0627\u062A \u062A\u0623\u062E\u06CC\u0631 \u067E\u0631\u062F\u0627\u062E\u062A \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", en: "Late interim payment losses" },
  { code: "adjustment_delay", fa: "\u062E\u0633\u0627\u0631\u0627\u062A \u062A\u0623\u062E\u06CC\u0631 \u067E\u0631\u062F\u0627\u062E\u062A \u062A\u0639\u062F\u06CC\u0644", en: "Late adjustment payment losses" },
  { code: "change_work", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0648 \u06A9\u0627\u0631\u0647\u0627\u06CC \u062C\u062F\u06CC\u062F", en: "Variations & new works" },
  { code: "labor", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0646\u06CC\u0631\u0648\u06CC \u0627\u0646\u0633\u0627\u0646\u06CC", en: "Labour costs" },
  { code: "machinery", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", en: "Plant & equipment costs" },
  { code: "suspension", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u062A\u0648\u0642\u0641 \u0648 \u062A\u0639\u0644\u06CC\u0642", en: "Suspension & stoppage" },
  { code: "remobilization", fa: "\u062A\u062C\u0647\u06CC\u0632 \u0648 \u0628\u0631\u0686\u06CC\u062F\u0646 \u0645\u062C\u062F\u062F \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "Remobilisation" },
  { code: "site_access_delay", fa: "\u062A\u0623\u062E\u06CC\u0631 \u062F\u0631 \u062A\u062D\u0648\u06CC\u0644 \u062C\u0628\u0647\u0647\u0654 \u06A9\u0627\u0631", en: "Late site access" },
  { code: "approval_delay", fa: "\u062A\u0623\u062E\u06CC\u0631 \u062F\u0631 \u0627\u0631\u0627\u0626\u0647 \u0645\u062F\u0627\u0631\u06A9 \u06CC\u0627 \u062A\u0623\u06CC\u06CC\u062F\u06CC\u0647\u200C\u0647\u0627", en: "Late documents / approvals" },
  { code: "procurement_extra", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0627\u0636\u0627\u0641\u06CC \u062A\u0623\u0645\u06CC\u0646 \u0648 \u062A\u062F\u0627\u0631\u06A9\u0627\u062A", en: "Extra procurement costs" },
  { code: "changed_conditions", fa: "\u062A\u063A\u06CC\u06CC\u0631 \u0634\u0631\u0627\u06CC\u0637 \u0627\u062C\u0631\u0627\u06CC\u06CC", en: "Changed conditions" },
  { code: "guarantee_extension", fa: "\u062A\u0645\u062F\u06CC\u062F \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u200C\u0647\u0627", en: "Guarantee extension" },
  { code: "site_facilities", fa: "\u062A\u062C\u0647\u06CC\u0632 \u0648 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "Site facilities" },
  { code: "other", fa: "\u0633\u0627\u06CC\u0631 \u062E\u0633\u0627\u0631\u0627\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC", en: "Other contractual losses" }
];
var LOSS_CATEGORY_CODES = LOSS_CATEGORIES.map((c) => c.code);
var lossCategoryFa = (code) => LOSS_CATEGORIES.find((c) => c.code === String(code ?? ""))?.fa ?? "\u0633\u0627\u06CC\u0631 \u062E\u0633\u0627\u0631\u0627\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC";
var RULE_KINDS = ["rate_qty_period", "amount_pct", "daily_rate_days", "actual_sum"];
var RULE_STATUSES = ["draft", "needs_review", "approved", "obsolete", "inactive"];
var round2 = (n) => Math.round(n * 100) / 100;
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
function validateInputs(kind, inputs, issues) {
  const out = {};
  const need = (key, fa) => {
    const v = num(inputs[key]);
    if (v === null) issues.push(`\u0648\u0631\u0648\u062F\u06CC \xAB${fa}\xBB \u0644\u0627\u0632\u0645 \u0627\u0633\u062A`);
    else if (v < 0) issues.push(`\u0648\u0631\u0648\u062F\u06CC \xAB${fa}\xBB \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0645\u0646\u0641\u06CC \u0628\u0627\u0634\u062F`);
    else out[key] = v;
  };
  if (kind === "rate_qty_period") {
    need("rate", "\u0646\u0631\u062E");
    need("quantity", "\u062A\u0639\u062F\u0627\u062F/\u0645\u0642\u062F\u0627\u0631");
    need("periodUnits", "\u062F\u0648\u0631\u0647/\u0648\u0627\u062D\u062F \u0632\u0645\u0627\u0646\u06CC");
  } else if (kind === "amount_pct") {
    need("baseAmount", "\u0645\u0628\u0644\u063A \u0645\u0628\u0646\u0627");
    need("pct", "\u062F\u0631\u0635\u062F");
    if (out.pct > 100) issues.push("\u062F\u0631\u0635\u062F \u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0628\u06CC\u0634 \u0627\u0632 \u06F1\u06F0\u06F0 \u0628\u0627\u0634\u062F");
  } else if (kind === "daily_rate_days") {
    need("dailyRate", "\u0646\u0631\u062E \u0631\u0648\u0632\u0627\u0646\u0647");
    need("days", "\u062A\u0639\u062F\u0627\u062F \u0631\u0648\u0632");
  } else if (kind === "actual_sum") {
    need("directAmount", "\u0647\u0632\u06CC\u0646\u0647\u0654 \u0645\u0633\u062A\u0642\u06CC\u0645");
    need("indirectAmount", "\u0647\u0632\u06CC\u0646\u0647\u0654 \u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645");
  } else issues.push("\u0646\u0648\u0639 \u0641\u0631\u0645\u0648\u0644 \u0642\u0627\u0639\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A");
  if (inputs.periodFrom && inputs.periodTo && inputs.periodTo < inputs.periodFrom) issues.push("\u067E\u0627\u06CC\u0627\u0646 \u062F\u0648\u0631\u0647 \u0642\u0628\u0644 \u0627\u0632 \u0622\u063A\u0627\u0632 \u0622\u0646 \u0627\u0633\u062A");
  return out;
}
function computeRaw(kind, v) {
  if (kind === "rate_qty_period") return v.rate * v.quantity * v.periodUnits;
  if (kind === "amount_pct") return v.baseAmount * v.pct / 100;
  if (kind === "daily_rate_days") return v.dailyRate * v.days;
  return v.directAmount + v.indirectAmount;
}
function evaluateLossRule(rule, inputs, opts) {
  const issues = [];
  const adj = num(opts?.manualAdjustment) ?? 0;
  const manualReason = (opts?.manualReason ?? "").trim() || null;
  const manualBy = (opts?.manualBy ?? "").trim() || null;
  if (adj !== 0 && (!manualReason || !manualBy)) issues.push("\u0627\u0635\u0644\u0627\u062D \u062F\u0633\u062A\u06CC \u0641\u0642\u0637 \u0628\u0627 \u062F\u0644\u06CC\u0644 \u0648 \u0647\u0648\u06CC\u062A \u06A9\u0627\u0631\u0628\u0631 \u0645\u062C\u0627\u0632 \u0627\u0633\u062A");
  if (!rule || !rule.Code) issues.push("\u0642\u0627\u0639\u062F\u0647\u0654 \u0645\u062D\u0627\u0633\u0628\u0647 \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A");
  if (rule && rule.Status !== "approved") issues.push("\u0642\u0627\u0639\u062F\u0647 \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0646\u062A\u06CC\u062C\u0647 \u0642\u0637\u0639\u06CC \u0635\u0627\u062F\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC \u0627\u0633\u062A");
  if (opts?.itemCurrency && inputs.currency && opts.itemCurrency !== inputs.currency) issues.push("\u0648\u0627\u062D\u062F \u067E\u0648\u0644 \u0648\u0631\u0648\u062F\u06CC \u0628\u0627 \u0648\u0627\u062D\u062F \u067E\u0648\u0644 \u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A \u06CC\u06A9\u0633\u0627\u0646 \u0646\u06CC\u0633\u062A");
  const values = rule ? validateInputs(String(rule.Kind), inputs, issues) : {};
  const fatal = issues.some((t) => !t.includes("\u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647"));
  if (!rule || rule.Status !== "approved" || fatal) {
    return { status: "needs_review", rawAmount: null, finalAmount: null, ruleVersion: rule?.Version ?? null, issues, manualAdjustment: adj, manualReason, manualBy };
  }
  const raw = round2(computeRaw(String(rule.Kind), values));
  return { status: "calculated", rawAmount: raw, finalAmount: round2(raw + adj), ruleVersion: rule.Version ?? null, issues, manualAdjustment: adj, manualReason, manualBy };
}
function evaluatePaymentDelayLoss(input) {
  const issues = [];
  const delayDays = num(input.delayDays);
  if (delayDays === null || delayDays < 0) issues.push("\u0645\u062F\u062A \u062A\u0623\u062E\u06CC\u0631 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0627\u0632 \u0645\u0627\u0698\u0648\u0644 \u062A\u0623\u062E\u06CC\u0631\u0627\u062A \u0644\u0627\u0632\u0645 \u0627\u0633\u062A");
  if (!input.financialRule) issues.push("\u0645\u0628\u0646\u0627\u06CC \u0645\u0627\u0644\u06CC \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F\u061B \u0635\u0631\u0641 \u062A\u0623\u062E\u06CC\u0631 \u067E\u0631\u062F\u0627\u062E\u062A \u0645\u062C\u0648\u0632 \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u0645\u0628\u0644\u063A \u062E\u0633\u0627\u0631\u062A \u0646\u06CC\u0633\u062A");
  else if (input.financialRule.Status !== "approved") issues.push("\u0642\u0627\u0639\u062F\u0647\u0654 \u0645\u0627\u0644\u06CC \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0645\u0628\u0644\u063A \u0642\u0637\u0639\u06CC \u0635\u0627\u062F\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F");
  if (delayDays === null || !input.financialRule || input.financialRule.Status !== "approved") {
    return { status: "needs_review", delayDays, amount: null, issues };
  }
  const result = evaluateLossRule(input.financialRule, { dailyRate: input.dailyRate, days: delayDays, currency: input.currency });
  return { status: result.status, delayDays, amount: result.finalAmount, issues: [...issues, ...result.issues] };
}
function periodsOverlap(aFrom, aTo, bFrom, bTo) {
  if (!aFrom || !bFrom) return false;
  const aEnd = aTo ?? aFrom, bEnd = bTo ?? bFrom;
  return aFrom <= bEnd && bFrom <= aEnd;
}
function detectCostOverlaps(items, allocations = []) {
  const out = [];
  const docUse = /* @__PURE__ */ new Map();
  for (const item of items) {
    for (const ref of Array.isArray(item.DocumentRefs) ? item.DocumentRefs : []) {
      const list = docUse.get(String(ref)) ?? [];
      list.push(String(item.Id));
      docUse.set(String(ref), list);
    }
  }
  for (const [ref, ids] of docUse) if (ids.length > 1) out.push({ kind: "duplicate_document", severity: "warning", itemIds: [...new Set(ids)], messageFa: `\u0633\u0646\u062F \xAB${ref}\xBB \u062F\u0631 \u0686\u0646\u062F \u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC \u0644\u0627\u0632\u0645 \u0627\u0633\u062A (\u0627\u062B\u0628\u0627\u062A \u062A\u06A9\u0631\u0627\u0631\u06CC\u200C\u0628\u0648\u062F\u0646 \u0646\u06CC\u0633\u062A)` });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    const sameAmount = Number(a.Amount) > 0 && Number(a.Amount) === Number(b.Amount);
    if (sameAmount && periodsOverlap(a.PeriodFrom, a.PeriodTo, b.PeriodFrom, b.PeriodTo)) {
      out.push({ kind: "duplicate_amount_period", severity: "warning", itemIds: [String(a.Id), String(b.Id)], messageFa: "\u062F\u0648 \u0642\u0644\u0645 \u0628\u0627 \u0645\u0628\u0644\u063A \u06CC\u06A9\u0633\u0627\u0646 \u0648 \u062F\u0648\u0631\u0647\u0654 \u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646 \u062B\u0628\u062A \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u061B \u0646\u0627\u0645\u0632\u062F \u0628\u0631\u0631\u0633\u06CC \u062A\u06A9\u0631\u0627\u0631\u06CC\u200C\u0628\u0648\u062F\u0646 (\u0634\u0628\u0627\u0647\u062A \u0645\u0628\u0644\u063A/\u062A\u0627\u0631\u06CC\u062E \u0628\u0647\u200C\u062A\u0646\u0647\u0627\u06CC\u06CC \u06A9\u0627\u0641\u06CC \u0646\u06CC\u0633\u062A)" });
    }
    const aIndirect = a.CostNature === "indirect" || a.LossCategory === "overhead" || a.CostType === "overhead";
    const bIndirect = b.CostNature === "indirect" || b.LossCategory === "overhead" || b.CostType === "overhead";
    if (aIndirect && bIndirect && periodsOverlap(a.PeriodFrom, a.PeriodTo, b.PeriodFrom, b.PeriodTo)) {
      out.push({ kind: "overhead_overlap", severity: "warning", itemIds: [String(a.Id), String(b.Id)], messageFa: "\u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u0627\u0642\u0644\u0627\u0645 \u0628\u0627\u0644\u0627\u0633\u0631\u06CC/\u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645\u061B \u0627\u062D\u062A\u0645\u0627\u0644 \u067E\u0648\u0634\u0634 \u062F\u0648\u0628\u0627\u0631\u0647\u0654 \u0633\u0631\u0628\u0627\u0631 \u0628\u0631\u0631\u0633\u06CC \u0634\u0648\u062F" });
    }
  }
  const byItem = /* @__PURE__ */ new Map();
  const eventsByItem = /* @__PURE__ */ new Map();
  for (const al of allocations) {
    const id = String(al.ClaimCostItemId);
    byItem.set(id, (byItem.get(id) ?? 0) + (Number(al.AllocationPct) || 0));
    const set = eventsByItem.get(id) ?? /* @__PURE__ */ new Set();
    set.add(String(al.DelayEventId));
    eventsByItem.set(id, set);
  }
  for (const [id, total] of byItem) {
    if (total > 100.0001) out.push({ kind: "allocation_over_100", severity: "violation", itemIds: [id], messageFa: `\u0645\u062C\u0645\u0648\u0639 \u062A\u062E\u0635\u06CC\u0635 \u0642\u0644\u0645 \u0627\u0632 \u06F1\u06F0\u06F0\u066A \u06AF\u0630\u0634\u062A\u0647 \u0627\u0633\u062A (${Math.round(total * 100) / 100}\u066A)\u061B \u0628\u062F\u0648\u0646 \u0631\u0648\u0634 \u062A\u062E\u0635\u06CC\u0635 \u0645\u0633\u062A\u0646\u062F \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A` });
    else if ((eventsByItem.get(id)?.size ?? 0) > 1) out.push({ kind: "shared_cost", severity: "warning", itemIds: [id], messageFa: "\u0647\u0632\u06CC\u0646\u0647 \u0628\u06CC\u0646 \u0686\u0646\u062F \u0631\u0648\u06CC\u062F\u0627\u062F \u0645\u0634\u062A\u0631\u06A9 \u062A\u062E\u0635\u06CC\u0635 \u06CC\u0627\u0641\u062A\u0647 \u0627\u0633\u062A\u061B \u0645\u0628\u0646\u0627\u06CC \u062A\u062E\u0635\u06CC\u0635 \u0628\u0627\u06CC\u062F \u0645\u0633\u062A\u0646\u062F \u0628\u0627\u0634\u062F" });
  }
  return out;
}
function summarizeLossPortfolio(claims, items, runs, versions = []) {
  const latestRunByItem = /* @__PURE__ */ new Map();
  for (const run of [...runs].sort((a, b) => String(a.CalculatedAt ?? "").localeCompare(String(b.CalculatedAt ?? "")))) latestRunByItem.set(String(run.ClaimCostItemId), run);
  const byClaim = /* @__PURE__ */ new Map();
  const ensure = (code) => {
    if (!byClaim.has(code)) byClaim.set(code, { claimCode: code, estimated: 0, calculated: 0, documented: 0, proposed: 0, approvedInternal: 0, accepted: null, finalDetermined: null, itemsCount: 0, itemsWithoutDocs: 0, itemsNeedingReview: 0, readyForDocument: false });
    return byClaim.get(code);
  };
  for (const claim of claims) {
    const row = ensure(String(claim.Code ?? ""));
    row.estimated += Number(claim.Amount) || 0;
    row.proposed += Number(claim.ProposedAmount) || 0;
    row.accepted = claim.DeterminedAmount === null || claim.DeterminedAmount === void 0 ? row.accepted : Number(claim.DeterminedAmount);
    row.finalDetermined = claim.SettlementAmount === null || claim.SettlementAmount === void 0 ? row.finalDetermined : Number(claim.SettlementAmount);
  }
  for (const item of items) {
    const code = String(item.ClaimCode ?? "");
    if (!code) continue;
    const row = ensure(code);
    row.itemsCount++;
    const run = latestRunByItem.get(String(item.Id));
    const calculated = run && run.FinalAmount !== null && run.FinalAmount !== void 0 ? Number(run.FinalAmount) : null;
    if (calculated !== null && Number.isFinite(calculated)) row.calculated += calculated;
    else row.itemsNeedingReview++;
    row.documented += Number(item.DocumentedAmount ?? (Array.isArray(item.DocumentRefs) && item.DocumentRefs.length ? item.Amount : 0)) || 0;
    row.approvedInternal += Number(item.ApprovedAmount) || 0;
    if (!Array.isArray(item.DocumentRefs) || !item.DocumentRefs.length) row.itemsWithoutDocs++;
  }
  const cases = [...byClaim.values()].map((row) => ({ ...row, readyForDocument: row.itemsCount > 0 && row.itemsNeedingReview === 0 }));
  const totals = cases.reduce((acc, c) => ({ estimated: acc.estimated + c.estimated, calculated: acc.calculated + c.calculated, documented: acc.documented + c.documented, proposed: acc.proposed + c.proposed, approvedInternal: acc.approvedInternal + c.approvedInternal }), { estimated: 0, calculated: 0, documented: 0, proposed: 0, approvedInternal: 0 });
  return {
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round2(v)])),
    cases,
    activeCases: claims.filter((c) => !["closed", "withdrawn", "settled"].includes(String(c.Status ?? ""))).length,
    incompleteDocs: cases.reduce((s, c) => s + c.itemsWithoutDocs, 0),
    needsReview: runs.filter((r) => r.Status === "needs_review").length,
    readyForDocument: cases.filter((c) => c.readyForDocument).length,
    pendingApproval: items.filter((i) => i.Status === "submitted").length,
    documentVersions: versions.length
  };
}
export {
  LOSS_CATEGORIES,
  LOSS_CATEGORY_CODES,
  LOSS_ENGINE_VERSION,
  RULE_KINDS,
  RULE_STATUSES,
  detectCostOverlaps,
  evaluateLossRule,
  evaluatePaymentDelayLoss,
  lossCategoryFa,
  summarizeLossPortfolio
};
