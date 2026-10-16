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
var lossCategoryFa = (code) => LOSS_CATEGORIES.find((c) => c.code === String(code ?? ""))?.fa ?? "\u0633\u0627\u06CC\u0631 \u062E\u0633\u0627\u0631\u0627\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC";

// src/services/claimLossDocument.ts
var LOSS_DOC_SECTIONS = [
  "\u0635\u0641\u062D\u0647 \u0639\u0646\u0648\u0627\u0646",
  "\u0645\u0634\u062E\u0635\u0627\u062A \u067E\u0631\u0648\u0698\u0647 \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F",
  "\u062E\u0644\u0627\u0635\u0647 \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC",
  "\u0645\u0648\u0636\u0648\u0639 \u0648 \u0645\u0628\u0646\u0627\u06CC \u0627\u062F\u0639\u0627",
  "\u0634\u0631\u062D \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u062E\u0633\u0627\u0631\u062A",
  "\u062E\u0637 \u0632\u0645\u0627\u0646\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627",
  "\u0645\u0628\u0627\u0646\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC",
  "\u0631\u0648\u0634 \u0645\u062D\u0627\u0633\u0628\u0647 \u0647\u0631 \u062F\u0633\u062A\u0647 \u062E\u0633\u0627\u0631\u062A",
  "\u062C\u062F\u0627\u0648\u0644 \u062A\u0641\u0635\u06CC\u0644\u06CC \u0645\u062D\u0627\u0633\u0628\u0627\u062A",
  "\u0627\u0633\u0646\u0627\u062F \u0648 \u0634\u0648\u0627\u0647\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646",
  "\u0627\u0631\u062A\u0628\u0627\u0637 \u062E\u0633\u0627\u0631\u062A \u0628\u0627 \u062A\u0623\u062E\u06CC\u0631\u0627\u062A",
  "\u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A\u200C\u0647\u0627",
  "\u06A9\u0646\u062A\u0631\u0644 \u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC \u0648 \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u0645\u0637\u0627\u0644\u0628\u0647 \u062A\u06A9\u0631\u0627\u0631\u06CC",
  "\u062C\u0645\u0639\u200C\u0628\u0646\u062F\u06CC \u0645\u0628\u0627\u0644\u063A",
  "\u0645\u062D\u062F\u0648\u062F\u06CC\u062A\u200C\u0647\u0627 \u0648 \u0641\u0631\u0636\u06CC\u0627\u062A",
  "\u0645\u0628\u0644\u063A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0637\u0627\u0644\u0628\u0647",
  "\u0646\u062A\u06CC\u062C\u0647 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC",
  "\u0641\u0647\u0631\u0633\u062A \u067E\u06CC\u0648\u0633\u062A\u200C\u0647\u0627"
];
var esc = (v) => String(v ?? "\u2014").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var faNum = (v) => {
  const n = Number(v);
  if (v === null || v === void 0 || v === "" || !Number.isFinite(n)) return "\u2014";
  return n.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
};
var faDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "\u2014";
  try {
    const j = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date(s + "T00:00:00"));
    return j;
  } catch {
    return s;
  }
};
var table = (heads, rows) => `<table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}">\u2014</td></tr>`}</tbody></table>`;
function buildClaimLossDocument(input) {
  const issues = [];
  const claim = input.claim;
  if (!claim?.Code) issues.push("\u0627\u062F\u0639\u0627\u06CC \u0645\u0639\u062A\u0628\u0631 \u0628\u0631\u0627\u06CC \u062A\u0647\u06CC\u0647\u0654 \u0644\u0627\u06CC\u062D\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  if (!input.costItems.length) issues.push("\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u0631\u0648\u0646\u062F\u0647 \u0647\u06CC\u0686 \u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0644\u0627\u06CC\u062D\u0647 \u0628\u062F\u0648\u0646 \u062C\u062F\u0648\u0644 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0635\u0627\u062F\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F");
  const caseAmounts = input.lossSummary?.cases.find((c) => c.claimCode === String(claim?.Code ?? ""));
  const latestRunByItem = /* @__PURE__ */ new Map();
  for (const run of [...input.runs].sort((a, b) => String(a.CalculatedAt ?? "").localeCompare(String(b.CalculatedAt ?? "")))) latestRunByItem.set(String(run.ClaimCostItemId), run);
  const ruleByCode = new Map(input.rules.map((r) => [String(r.Code), r]));
  const eventById = new Map(input.delayEvents.map((e) => [String(e.Id), e]));
  const itemRows = input.costItems.map((item, i) => {
    const run = latestRunByItem.get(String(item.Id));
    const calculated = run && run.FinalAmount !== null && run.FinalAmount !== void 0 ? faNum(run.FinalAmount) : "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC";
    const docs = (Array.isArray(item.DocumentRefs) ? item.DocumentRefs : []).map((id) => {
      const d = input.documentById.get(String(id));
      return d ? `${esc(d.DocNo)}@${esc(d.Revision)}` : esc(id);
    }).join("\u060C ") || "\u2014";
    return [String(i + 1), esc(item.TitleFa), esc(lossCategoryFa(item.LossCategory ?? item.CostType)), esc(item.CostNature === "direct" ? "\u0645\u0633\u062A\u0642\u06CC\u0645" : item.CostNature === "indirect" ? "\u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645" : "\u2014"), faDate(item.PeriodFrom) + " \u062A\u0627 " + faDate(item.PeriodTo), faNum(item.Amount), calculated, faNum(item.DocumentedAmount), faNum(item.ApprovedAmount), docs];
  });
  const eventRows = input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.TitleFa), faDate(e.StartDate), faDate(e.FinishDate), esc(e.Status), faNum(e.CompletionImpactDays)]);
  const runRows = input.costItems.map((item, i) => {
    const run = latestRunByItem.get(String(item.Id));
    if (!run) return [String(i + 1), esc(item.TitleFa), "\u2014", "\u2014", "\u0627\u062C\u0631\u0627 \u0646\u0634\u062F\u0647\u061B \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC"];
    const rule = ruleByCode.get(String(run.RuleCode ?? ""));
    return [String(i + 1), esc(item.TitleFa), esc(run.RuleCode ?? "\u2014") + " v" + esc(run.RuleVersion ?? rule?.Version ?? "\u2014"), esc(run.Status === "calculated" ? "\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647" : "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC"), faNum(run.FinalAmount)];
  });
  const allocRows = input.allocations.map((a, i) => [String(i + 1), esc(input.costItems.find((x) => String(x.Id) === String(a.ClaimCostItemId))?.TitleFa ?? a.ClaimCostItemId), esc(eventById.get(String(a.DelayEventId))?.Code ?? a.DelayEventId), faNum(a.AllocationPct) + "\u066A", esc(a.Basis ?? "\u2014")]);
  const docRows = [];
  let docIndex = 0;
  for (const item of input.costItems) for (const id of Array.isArray(item.DocumentRefs) ? item.DocumentRefs : []) {
    const d = input.documentById.get(String(id));
    docRows.push([String(++docIndex), esc(d?.DocNo ?? id), esc(d?.Revision ?? "\u2014"), esc(d?.TitleFa ?? "\u2014"), esc(d?.Status ?? "\u2014"), esc(item.TitleFa)]);
  }
  const categoryRows = [...new Set(input.costItems.map((i) => String(i.LossCategory ?? i.CostType)))].map((code) => [esc(lossCategoryFa(code)), esc(LOSS_CATEGORIES.find((c) => c.code === code)?.en ?? code), esc(input.costItems.filter((i) => String(i.LossCategory ?? i.CostType) === code).map((i) => String(ruleByCode.get(String(i.RuleCode ?? ""))?.FormulaFa ?? "")).filter(Boolean)[0] ?? "\u0642\u0627\u0639\u062F\u0647\u0654 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u062B\u0628\u062A\u200C\u0634\u062F\u0647 \u0628\u0631\u0627\u06CC \u0627\u0642\u0644\u0627\u0645 \u0627\u06CC\u0646 \u062F\u0633\u062A\u0647 \u062F\u0631 \u062C\u062F\u0648\u0644 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0622\u0645\u062F\u0647 \u0627\u0633\u062A")]);
  const s = [];
  const sec = (n, title, body2) => s.push(`<h2>${n}. ${esc(title)}</h2>${body2}`);
  sec(1, LOSS_DOC_SECTIONS[0], `<div class="cover"><h1>\u0644\u0627\u06CC\u062D\u0647\u0654 \u0636\u0631\u0631 \u0648 \u0632\u06CC\u0627\u0646 \u067E\u06CC\u0645\u0627\u0646</h1><p>\u067E\u0631\u0648\u0646\u062F\u0647: <b>${esc(claim.Code)}</b> \u2014 ${esc(claim.TitleFa)}</p><p>\u0648\u0636\u0639\u06CC\u062A \u0633\u0646\u062F: <b>\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633</b> \u2014 \u062A\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0645\u0633\u0626\u0648\u0644 \u0645\u0631\u0628\u0648\u0637\u060C \u0633\u0646\u062F \u0646\u0647\u0627\u06CC\u06CC \u0645\u062D\u0633\u0648\u0628 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.</p><p>\u0646\u0633\u062E\u0647\u0654 \u0644\u0627\u06CC\u062D\u0647: ${faNum(input.version)} \xB7 \u062A\u0627\u0631\u06CC\u062E \u062A\u0648\u0644\u06CC\u062F: ${faDate(input.generatedAt)}</p></div>`);
  sec(2, LOSS_DOC_SECTIONS[1], table(["\u0645\u0648\u0631\u062F", "\u0645\u0642\u062F\u0627\u0631"], [["\u067E\u0631\u0648\u0698\u0647", esc(input.projectId)], ["\u06A9\u062F \u0627\u062F\u0639\u0627", esc(claim.Code)], ["\u0639\u0646\u0648\u0627\u0646", esc(claim.TitleFa)], ["\u0628\u0646\u062F \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC", esc(claim.Clause)], ["\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u0648\u0646\u062F\u0647", esc(claim.Status)], ["\u062A\u0627\u0631\u06CC\u062E \u0631\u0648\u06CC\u062F\u0627\u062F", faDate(claim.EventDate)]]));
  sec(3, LOSS_DOC_SECTIONS[2], `<p>\u0627\u06CC\u0646 \u0644\u0627\u06CC\u062D\u0647 \u0628\u0631 \u0645\u0628\u0646\u0627\u06CC \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0648\u0627\u0642\u0639\u06CC \u067E\u0631\u0648\u0646\u062F\u0647\u060C \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0646\u0633\u062E\u0647\u200C\u062F\u0627\u0631 \u0648 \u0627\u0633\u0646\u0627\u062F EDMS \u067E\u06CC\u0648\u0646\u062F\u0634\u062F\u0647 \u062A\u0648\u0644\u06CC\u062F \u0634\u062F\u0647 \u0627\u0633\u062A. \u0647\u0631\u062C\u0627 \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u06CC\u0627 \u0645\u062F\u0631\u06A9 \u06A9\u0627\u0641\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F\u060C \u0645\u0642\u062F\u0627\u0631 \u0628\u0627 \xAB\u2014\xBB \u0648 \u0628\u0631\u0686\u0633\u0628 \xAB\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC\xBB \u0645\u0634\u062E\u0635 \u0634\u062F\u0647 \u0648 \u0647\u06CC\u0686 \u0639\u062F\u062F\u06CC \u062D\u062F\u0633 \u0632\u062F\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</p>` + (caseAmounts ? table(["\u0634\u0627\u062E\u0635", "\u0645\u0628\u0644\u063A"], [["\u0628\u0631\u0622\u0648\u0631\u062F \u0627\u0648\u0644\u06CC\u0647", faNum(caseAmounts.estimated)], ["\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647", faNum(caseAmounts.calculated)], ["\u0645\u0633\u062A\u0646\u062F\u0634\u062F\u0647", faNum(caseAmounts.documented)], ["\u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0637\u0627\u0644\u0628\u0647", faNum(caseAmounts.proposed)], ["\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u062F\u0627\u062E\u0644\u06CC", faNum(caseAmounts.approvedInternal)]]) : "<p>\u2014</p>"));
  sec(4, LOSS_DOC_SECTIONS[3], `<p>${esc(claim.Entitlement ?? "\u2014")}</p><p>${esc(claim.Causation ?? "\u2014")}</p>`);
  sec(5, LOSS_DOC_SECTIONS[4], table(["#", "\u06A9\u062F \u0631\u0648\u06CC\u062F\u0627\u062F", "\u0639\u0646\u0648\u0627\u0646", "\u0634\u0631\u0648\u0639", "\u067E\u0627\u06CC\u0627\u0646", "\u0648\u0636\u0639\u06CC\u062A", "\u0627\u062B\u0631 \u0628\u0631 \u0627\u062A\u0645\u0627\u0645 (\u0631\u0648\u0632)"], eventRows));
  sec(6, LOSS_DOC_SECTIONS[5], table(["#", "\u0631\u0648\u06CC\u062F\u0627\u062F", "\u062A\u0627\u0631\u06CC\u062E"], input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code) + " \u2014 " + esc(e.TitleFa), faDate(e.StartDate) + " \u062A\u0627 " + faDate(e.FinishDate)])));
  sec(7, LOSS_DOC_SECTIONS[6], `<p>\u0628\u0646\u062F \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC: ${esc(claim.Clause ?? "\u2014")}</p><p>\u0645\u0628\u0646\u0627\u06CC \u0627\u0633\u062A\u062D\u0642\u0627\u0642: ${esc(claim.Entitlement ?? "\u2014")}</p>`);
  sec(8, LOSS_DOC_SECTIONS[7], table(["\u062F\u0633\u062A\u0647\u0654 \u062E\u0633\u0627\u0631\u062A", "Category", "\u0631\u0648\u0634/\u0641\u0631\u0645\u0648\u0644"], categoryRows));
  sec(9, LOSS_DOC_SECTIONS[8], table(["#", "\u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A", "\u062F\u0633\u062A\u0647", "\u0645\u0627\u0647\u06CC\u062A", "\u062F\u0648\u0631\u0647", "\u0645\u0628\u0644\u063A \u062B\u0628\u062A\u200C\u0634\u062F\u0647", "\u0645\u0628\u0644\u063A \u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647", "\u0645\u0633\u062A\u0646\u062F", "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647", "\u0627\u0633\u0646\u0627\u062F"], itemRows) + "<h3>\u0627\u062C\u0631\u0627\u0647\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647</h3>" + table(["#", "\u0642\u0644\u0645", "\u0642\u0627\u0639\u062F\u0647 \u0648 \u0646\u0633\u062E\u0647", "\u0648\u0636\u0639\u06CC\u062A", "\u0645\u0628\u0644\u063A \u0646\u0647\u0627\u06CC\u06CC"], runRows));
  sec(10, LOSS_DOC_SECTIONS[9], table(["\u067E\u06CC\u0648\u0633\u062A", "\u0634\u0645\u0627\u0631\u0647 \u0633\u0646\u062F", "\u0646\u0633\u062E\u0647", "\u0639\u0646\u0648\u0627\u0646", "\u0648\u0636\u0639\u06CC\u062A", "\u0642\u0644\u0645 \u0645\u0631\u062A\u0628\u0637"], docRows));
  sec(11, LOSS_DOC_SECTIONS[10], `<p>\u0645\u062F\u062A \u062A\u0623\u062E\u06CC\u0631\u060C \u0645\u062F\u062A \u062A\u0645\u062F\u06CC\u062F \u0642\u0627\u0628\u0644 \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0648 \u0645\u0628\u0644\u063A \u062E\u0633\u0627\u0631\u062A \u0633\u0647 \u062E\u0631\u0648\u062C\u06CC \u0645\u062A\u0641\u0627\u0648\u062A\u200C\u0627\u0646\u062F \u0648 \u062F\u0631 \u0627\u06CC\u0646 \u0644\u0627\u06CC\u062D\u0647 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u06AF\u0632\u0627\u0631\u0634 \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u061B \u0647\u06CC\u0686\u200C\u06A9\u062F\u0627\u0645 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0645\u0639\u0627\u062F\u0644 \u062F\u06CC\u06AF\u0631\u06CC \u0641\u0631\u0636 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</p>` + table(["#", "\u0631\u0648\u06CC\u062F\u0627\u062F", "\u0627\u062B\u0631 \u0628\u0631 \u0627\u062A\u0645\u0627\u0645 (\u0631\u0648\u0632)", "\u0648\u0636\u0639\u06CC\u062A"], input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), faNum(e.CompletionImpactDays), esc(e.Status)])));
  sec(12, LOSS_DOC_SECTIONS[11], `<p>${esc(claim.QuantumNote ?? "\u062F\u0631 \u0635\u0648\u0631\u062A \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A\u200C\u0647\u0627\u060C \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0627\u0632 \u0646\u062A\u0627\u06CC\u062C \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u0628\u062E\u0634\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u06F1\u06F3\u06F0\u06F0/\u06F5\u06F0\u06F9\u06F0 \u0645\u0627\u0698\u0648\u0644 \u062A\u0623\u062E\u06CC\u0631\u0627\u062A \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u0641\u0631\u0645\u0648\u0644 \u062F\u0631 \u062F\u0648 \u0645\u0627\u0698\u0648\u0644 \u062A\u06A9\u0631\u0627\u0631 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.")}</p>`);
  sec(13, LOSS_DOC_SECTIONS[12], (input.overlapWarnings.length ? table(["#", "\u0634\u062F\u062A", "\u0647\u0634\u062F\u0627\u0631"], input.overlapWarnings.map((w, i) => [String(i + 1), esc(w.severity === "violation" ? "\u0646\u0642\u0636" : "\u0647\u0634\u062F\u0627\u0631"), esc(w.messageFa)])) : "<p>\u0647\u0634\u062F\u0627\u0631 \u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</p>") + table(["#", "\u0642\u0644\u0645", "\u0631\u0648\u06CC\u062F\u0627\u062F \u0645\u0642\u0635\u062F", "\u062F\u0631\u0635\u062F \u062A\u062E\u0635\u06CC\u0635", "\u0645\u0628\u0646\u0627"], allocRows));
  sec(14, LOSS_DOC_SECTIONS[13], caseAmounts ? table(["\u0645\u0628\u0644\u063A", "\u0645\u0642\u062F\u0627\u0631"], [["\u0628\u0631\u0622\u0648\u0631\u062F \u0627\u0648\u0644\u06CC\u0647", faNum(caseAmounts.estimated)], ["\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647", faNum(caseAmounts.calculated)], ["\u0645\u0633\u062A\u0646\u062F\u0634\u062F\u0647", faNum(caseAmounts.documented)], ["\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u062F\u0627\u062E\u0644\u06CC", faNum(caseAmounts.approvedInternal)], ["\u067E\u0630\u06CC\u0631\u0641\u062A\u0647\u200C\u0634\u062F\u0647\u0654 \u0637\u0631\u0641 \u0645\u0642\u0627\u0628\u0644", faNum(caseAmounts.accepted)], ["\u0646\u0647\u0627\u06CC\u06CC \u062A\u0639\u06CC\u06CC\u0646\u200C\u0634\u062F\u0647", faNum(caseAmounts.finalDetermined)]]) : "<p>\u2014</p>");
  sec(15, LOSS_DOC_SECTIONS[14], "<p>\u0641\u0631\u0636\u06CC\u0627\u062A \u0647\u0631 \u0645\u062D\u0627\u0633\u0628\u0647 \u062F\u0631 \u0627\u062C\u0631\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u0645\u0631\u0628\u0648\u0637 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A. \u0642\u0648\u0627\u0639\u062F \u062A\u0623\u06CC\u06CC\u062F\u0646\u0634\u062F\u0647 \u0645\u0628\u0646\u0627\u06CC \u0642\u0637\u0639\u06CC \u0645\u0637\u0627\u0644\u0628\u0647 \u0646\u06CC\u0633\u062A\u0646\u062F \u0648 \u0646\u062A\u0627\u06CC\u062C \u0622\u0646\u200C\u0647\u0627 \xAB\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC\xBB \u06AF\u0632\u0627\u0631\u0634 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.</p>");
  sec(16, LOSS_DOC_SECTIONS[15], `<p>\u0645\u0628\u0644\u063A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0637\u0627\u0644\u0628\u0647: <b>${faNum(caseAmounts?.proposed)}</b> (\u062C\u062F\u0627 \u0627\u0632 \u0645\u0628\u0644\u063A \u0628\u0631\u0622\u0648\u0631\u062F\u06CC \u0648 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u061B \u0628\u062F\u0648\u0646 \u0633\u0627\u0628\u0642\u0647 \u0628\u0647 \u0622\u0646\u200C\u0647\u0627 \u062A\u0628\u062F\u06CC\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A).</p>`);
  sec(17, LOSS_DOC_SECTIONS[16], "<p>\u0646\u062A\u06CC\u062C\u0647\u0654 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC \u067E\u0633 \u0627\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0645\u0633\u0626\u0648\u0644 \u0645\u0631\u0628\u0648\u0637 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u062B\u0628\u062A \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0627\u06CC\u0646 \u0633\u0646\u062F \u062A\u0627 \u0622\u0646 \u0632\u0645\u0627\u0646 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u0627\u0633\u062A.</p>");
  sec(18, LOSS_DOC_SECTIONS[17], table(["\u067E\u06CC\u0648\u0633\u062A", "\u0634\u0645\u0627\u0631\u0647 \u0633\u0646\u062F", "\u0646\u0633\u062E\u0647", "\u0639\u0646\u0648\u0627\u0646"], docRows.map((r) => r.slice(0, 4))));
  const body = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>\u0644\u0627\u06CC\u062D\u0647 \u0636\u0631\u0631 \u0648 \u0632\u06CC\u0627\u0646 ${esc(claim.Code)}</title>
<style>@page{size:A4;margin:18mm}body{font-family:'B Nazanin',Tahoma,sans-serif;font-size:12pt;line-height:1.9;color:#111}h1{font-size:19pt}h2{font-size:14pt;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin-top:22px}h3{font-size:12.5pt}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #666;padding:5px 7px;font-size:10.5pt;text-align:right;vertical-align:top}th{background:#dbe7f3}.cover{border:2px solid #1f4e79;padding:24px;text-align:center;margin-top:60px}</style></head>
<body>${s.join("\n")}</body></html>`;
  return { body, issues, filename: `LossClaim-${String(claim.Code ?? "claim")}-v${input.version}.${input.format === "pdf" ? "html" : "doc"}`, contentType: "application/msword; charset=utf-8" };
}
export {
  LOSS_DOC_SECTIONS,
  buildClaimLossDocument
};
