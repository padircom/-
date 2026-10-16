// src/services/claimLoss.ts
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

// src/services/lossAiAssist.ts
var LOSS_ASSIST_VERSION = "loss-assist-v1";
var sug = (kind, severity, refId, messageFa, sourceFa) => ({ kind, severity, refId, messageFa, sourceFa, needsExpertReview: true });
function extractFromDocumentText(text) {
  const t = String(text ?? "").replace(/[۰-۹]/g, (d) => String("\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(d))).replace(/[٠-٩]/g, (d) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)));
  const amounts = [];
  for (const m of t.matchAll(/([\d][\d,.\s]{2,})\s*(ریال|تومان|IRR|میليون|میلیون|میلیارد)/g)) {
    const value = Number(m[1].replace(/[,\s]/g, ""));
    if (Number.isFinite(value) && value > 0) amounts.push({ value, unit: m[2], raw: m[0].trim() });
  }
  const dates = [...new Set([...t.matchAll(/\b(1[34]\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|\d{4}-\d{2}-\d{2})\b/g)].map((m) => m[1]))];
  const statementNos = [...new Set([...t.matchAll(/صورت\s*وضعیت[^0-9]{0,12}(\d{1,3})/g)].map((m) => m[1]))];
  const contractNos = [...new Set([...t.matchAll(/(?:قرارداد|پیمان)[^0-9A-Za-z]{0,12}([A-Za-z]{0,4}[-/]?\d{2,})/g)].map((m) => m[1]))];
  return { amounts: amounts.slice(0, 20), dates, statementNos, contractNos };
}
var CATEGORY_KEYWORDS = [
  ["payment_delay", ["\u067E\u0631\u062F\u0627\u062E\u062A", "\u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", "\u0635\u0648\u0631\u062A \u0648\u0636\u0639\u06CC\u062A", "\u06F5\u06F0\u06F9\u06F0", "5090"]],
  ["adjustment_delay", ["\u062A\u0639\u062F\u06CC\u0644"]],
  ["overhead", ["\u0633\u0631\u0628\u0627\u0631", "\u0628\u0627\u0644\u0627\u0633\u0631\u06CC", "\u067E\u0631\u0633\u0646\u0644 \u062B\u0627\u0628\u062A", "\u0647\u0632\u06CC\u0646\u0647 \u062B\u0627\u0628\u062A"]],
  ["guarantee_extension", ["\u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647", "\u0636\u0645\u0627\u0646\u062A \u0646\u0627\u0645\u0647"]],
  ["suspension", ["\u062A\u0639\u0644\u06CC\u0642", "\u062A\u0648\u0642\u0641 \u06A9\u0627\u0631", "\u062A\u0648\u0642\u0641 \u0639\u0645\u0644\u06CC\u0627\u062A"]],
  ["machinery", ["\u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", "\u0645\u0627\u0634\u06CC\u0646 \u0627\u0644\u0627\u062A", "\u062A\u062C\u0647\u06CC\u0632\u0627\u062A", "\u062C\u0631\u062B\u0642\u06CC\u0644", "\u06A9\u0645\u067E\u0631\u0633\u06CC"]],
  ["labor", ["\u0646\u06CC\u0631\u0648\u06CC \u0627\u0646\u0633\u0627\u0646\u06CC", "\u067E\u0631\u0633\u0646\u0644", "\u06A9\u0627\u0631\u06AF\u0631", "\u0646\u0641\u0631"]],
  ["change_work", ["\u062F\u0633\u062A\u0648\u0631 \u062A\u063A\u06CC\u06CC\u0631", "\u06A9\u0627\u0631 \u062C\u062F\u06CC\u062F", "\u062A\u063A\u06CC\u06CC\u0631 \u0645\u0642\u0627\u062F\u06CC\u0631", "\u0627\u0644\u062D\u0627\u0642\u06CC\u0647"]],
  ["site_access_delay", ["\u062A\u062D\u0648\u06CC\u0644 \u0632\u0645\u06CC\u0646", "\u062C\u0628\u0647\u0647 \u06A9\u0627\u0631", "\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u06A9\u0627\u0631\u06AF\u0627\u0647"]],
  ["approval_delay", ["\u062A\u0623\u06CC\u06CC\u062F \u0646\u0642\u0634\u0647", "\u062A\u0627\u06CC\u06CC\u062F \u0646\u0642\u0634\u0647", "\u0645\u062F\u0627\u0631\u06A9", "\u062A\u0623\u06CC\u06CC\u062F\u06CC\u0647"]],
  ["procurement_extra", ["\u062A\u062F\u0627\u0631\u06A9\u0627\u062A", "\u062E\u0631\u06CC\u062F", "\u062A\u0623\u0645\u06CC\u0646 \u06A9\u0627\u0644\u0627", "\u062A\u0627\u0645\u06CC\u0646 \u06A9\u0627\u0644\u0627"]],
  ["remobilization", ["\u0628\u0631\u0686\u06CC\u062F\u0646", "\u062A\u062C\u0647\u06CC\u0632 \u0645\u062C\u062F\u062F"]],
  ["site_running_costs", ["\u0647\u0632\u06CC\u0646\u0647 \u062C\u0627\u0631\u06CC", "\u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647", "\u0647\u0632\u06CC\u0646\u0647 \u0645\u0633\u062A\u0645\u0631"]],
  ["changed_conditions", ["\u0634\u0631\u0627\u06CC\u0637 \u0627\u062C\u0631\u0627\u06CC\u06CC", "\u0634\u0631\u0627\u06CC\u0637 \u067E\u06CC\u0634\u200C\u0628\u06CC\u0646\u06CC\u200C\u0646\u0634\u062F\u0647"]]
];
function suggestLossCategory(text) {
  const t = String(text ?? "");
  let best = null;
  for (const [code, words] of CATEGORY_KEYWORDS) {
    const matched = words.filter((w) => t.includes(w));
    if (matched.length && (!best || matched.length > best.matched.length)) best = { code, matched };
  }
  if (!best) return null;
  return { code: best.code, fa: LOSS_CATEGORIES.find((c) => c.code === best.code)?.fa ?? best.code, matched: best.matched };
}
var day = (v) => String(v ?? "").slice(0, 10);
function buildLossSuggestions(input) {
  const suggestions = [];
  const claim = input.claim;
  for (const item of input.costItems) {
    const refs = Array.isArray(item.DocumentRefs) ? item.DocumentRefs : [];
    if (!refs.length) suggestions.push(sug("missing_document", "warning", String(item.Id), `\u0642\u0644\u0645 \xAB${String(item.TitleFa)}\xBB \u0633\u0646\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 EDMS \u0646\u062F\u0627\u0631\u062F\u061B \u0645\u0628\u0644\u063A \u0622\u0646 \u0645\u0633\u062A\u0646\u062F \u0645\u062D\u0633\u0648\u0628 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F`, "\u06A9\u0646\u062A\u0631\u0644 \u0646\u0642\u0635 \u0645\u062F\u0627\u0631\u06A9"));
    if (!String(item.Basis ?? "").trim()) suggestions.push(sug("missing_basis", "warning", String(item.Id), `\u0642\u0644\u0645 \xAB${String(item.TitleFa)}\xBB \u0645\u0628\u0646\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647 \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0646\u062F\u0627\u0631\u062F`, "\u06A9\u0646\u062A\u0631\u0644 \u0645\u0628\u0646\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0627\u062A\u06CC"));
    const cat = suggestLossCategory(`${String(item.TitleFa ?? "")} ${String(item.Basis ?? "")}`);
    if (cat && cat.code !== String(item.LossCategory ?? item.CostType)) suggestions.push(sug("category_suggestion", "info", String(item.Id), `\u0628\u0631\u0627\u06CC \u0642\u0644\u0645 \xAB${String(item.TitleFa)}\xBB \u062F\u0633\u062A\u0647\u0654 \xAB${cat.fa}\xBB \u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F (\u06A9\u0644\u06CC\u062F\u0648\u0627\u0698\u0647: ${cat.matched.join("\u060C ")})\u061B \u062F\u0633\u062A\u0647\u0654 \u0641\u0639\u0644\u06CC \u0645\u062A\u0641\u0627\u0648\u062A \u0627\u0633\u062A`, "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u062F\u0633\u062A\u0647 \u0627\u0632 \u0645\u062A\u0646"));
    const event = input.delayEvents.find((e) => String(e.Id) === String(item.DelayEventId));
    if (event && item.PeriodFrom && item.PeriodTo && (day(item.PeriodFrom) < day(event.StartDate) || day(item.PeriodTo) > day(event.FinishDate))) {
      suggestions.push(sug("date_contradiction", "warning", String(item.Id), `\u062F\u0648\u0631\u0647\u0654 \u0642\u0644\u0645 \xAB${String(item.TitleFa)}\xBB (${day(item.PeriodFrom)} \u062A\u0627 ${day(item.PeriodTo)}) \u0628\u06CC\u0631\u0648\u0646 \u0627\u0632 \u0628\u0627\u0632\u0647\u0654 \u0631\u0648\u06CC\u062F\u0627\u062F \xAB${String(event.Code)}\xBB \u0627\u0633\u062A\u061B \u0628\u0631\u0631\u0633\u06CC \u0634\u0648\u062F`, "\u06A9\u0646\u062A\u0631\u0644 \u0633\u0627\u0632\u06AF\u0627\u0631\u06CC \u062A\u0627\u0631\u06CC\u062E\u200C\u0647\u0627"));
    }
  }
  if (!input.costItems.length) suggestions.push(sug("missing_document", "warning", null, "\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u0631\u0648\u0646\u062F\u0647 \u0647\u0646\u0648\u0632 \u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A", "\u06A9\u0646\u062A\u0631\u0644 \u06A9\u0627\u0645\u0644\u200C\u0628\u0648\u062F\u0646 \u067E\u0631\u0648\u0646\u062F\u0647"));
  if (!String(claim.Entitlement ?? "").trim() || !String(claim.Causation ?? "").trim()) suggestions.push(sug("missing_basis", "warning", null, "\u0645\u0628\u0646\u0627\u06CC \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u06CC\u0627 \u0631\u0627\u0628\u0637\u0647\u0654 \u0633\u0628\u0628\u06CC\u062A \u067E\u0631\u0648\u0646\u062F\u0647 \u06A9\u0627\u0645\u0644 \u0646\u06CC\u0633\u062A\u061B \u0644\u0627\u06CC\u062D\u0647 \u0628\u062F\u0648\u0646 \u0622\u0646 \u0642\u0637\u0639\u06CC \u0646\u06CC\u0633\u062A", "\u06A9\u0646\u062A\u0631\u0644 \u0645\u0628\u0627\u0646\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC"));
  for (const w of detectCostOverlaps(input.costItems, input.allocations)) suggestions.push(sug("overlap_candidate", w.severity === "violation" ? "warning" : "info", w.itemIds[0] ?? null, w.messageFa, "\u06A9\u0646\u062A\u0631\u0644 \u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC"));
  const linked = new Set(input.costItems.flatMap((i) => Array.isArray(i.DocumentRefs) ? i.DocumentRefs.map(String) : []));
  for (const doc of input.documents) {
    if (linked.has(String(doc.Id))) continue;
    const cat = suggestLossCategory(String(doc.TitleFa ?? ""));
    if (cat) suggestions.push(sug("document_link_suggestion", "info", String(doc.Id), `\u0633\u0646\u062F \xAB${String(doc.DocNo)}@${String(doc.Revision)}\xBB (${String(doc.TitleFa)}) \u067E\u06CC\u0648\u0646\u062F \u0646\u0634\u062F\u0647 \u0648 \u0628\u0627 \u062F\u0633\u062A\u0647\u0654 \xAB${cat.fa}\xBB \u0647\u0645\u200C\u062E\u0648\u0627\u0646 \u0627\u0633\u062A\u061B \u067E\u06CC\u0648\u0646\u062F \u0622\u0646 \u0628\u0631\u0631\u0633\u06CC \u0634\u0648\u062F`, "\u067E\u06CC\u0634\u0646\u0647\u0627\u062F \u0627\u0631\u062A\u0628\u0627\u0637 \u0633\u0646\u062F \u0648 \u0631\u0648\u06CC\u062F\u0627\u062F"));
  }
  const extracted = input.documentText ? extractFromDocumentText(input.documentText) : null;
  if (extracted && (extracted.amounts.length || extracted.dates.length || extracted.statementNos.length)) {
    suggestions.push(sug("extraction", "info", null, `\u0627\u0632 \u0645\u062A\u0646 \u0633\u0646\u062F: ${extracted.amounts.length} \u0645\u0628\u0644\u063A\u060C ${extracted.dates.length} \u062A\u0627\u0631\u06CC\u062E \u0648 ${extracted.statementNos.length} \u0634\u0645\u0627\u0631\u0647\u0654 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0634\u062F\u061B \u067E\u06CC\u0634 \u0627\u0632 \u062B\u0628\u062A \u0628\u0627 \u0627\u0635\u0644 \u0633\u0646\u062F \u062A\u0637\u0628\u06CC\u0642 \u0634\u0648\u062F`, "\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0632 \u0645\u062A\u0646 \u0633\u0646\u062F"));
  }
  const totalItems = input.costItems.length;
  const draftDescriptionFa = totalItems ? `\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633: \u062F\u0631 \u067E\u0631\u0648\u0646\u062F\u0647\u0654 \xAB${String(claim.TitleFa)}\xBB (${String(claim.Code)}) \u062A\u0639\u062F\u0627\u062F ${totalItems} \u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A \u062F\u0631 \u062F\u0633\u062A\u0647\u200C\u0647\u0627\u06CC ${[...new Set(input.costItems.map((i) => String(i.LossCategory ?? i.CostType)))].join("\u060C ")} \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A. \u0645\u0628\u0646\u0627\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC \u0627\u0639\u0644\u0627\u0645\u200C\u0634\u062F\u0647: ${String(claim.Clause ?? "\u2014")}. \u0645\u0628\u0627\u0644\u063A \u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647 \u0641\u0642\u0637 \u0627\u0632 \u0627\u062C\u0631\u0627\u0647\u0627\u06CC \u0646\u0633\u062E\u0647\u200C\u062F\u0627\u0631 \u0642\u0648\u0627\u0639\u062F \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u06AF\u0631\u0641\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u0627\u0642\u0644\u0627\u0645 \u0641\u0627\u0642\u062F \u0645\u062D\u0627\u0633\u0628\u0647 \u06CC\u0627 \u0633\u0646\u062F\u060C \xAB\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC\xBB \u0647\u0633\u062A\u0646\u062F. \u0627\u06CC\u0646 \u0645\u062A\u0646 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u0627\u0633\u062A \u0648 \u067E\u06CC\u0634 \u0627\u0632 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u062F\u0631 \u0644\u0627\u06CC\u062D\u0647 \u0628\u0627\u06CC\u062F \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC \u0648 \u062A\u0623\u06CC\u06CC\u062F \u0634\u0648\u062F.` : `\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633: \u0628\u0631\u0627\u06CC \u067E\u0631\u0648\u0646\u062F\u0647\u0654 \xAB${String(claim.TitleFa)}\xBB \u0647\u0646\u0648\u0632 \u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0634\u0631\u062D \u062E\u0633\u0627\u0631\u062A \u067E\u0633 \u0627\u0632 \u062B\u0628\u062A \u0627\u0642\u0644\u0627\u0645 \u0648 \u0645\u062F\u0627\u0631\u06A9 \u0642\u0627\u0628\u0644 \u062A\u0647\u06CC\u0647 \u0627\u0633\u062A.`;
  return { provider: "rule", llmConnected: false, version: LOSS_ASSIST_VERSION, suggestions, extracted, draftDescriptionFa };
}
export {
  LOSS_ASSIST_VERSION,
  buildLossSuggestions,
  extractFromDocumentText,
  suggestLossCategory
};
