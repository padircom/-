// src/services/ogWbs.ts
var OG_WBS_VERSION = "ogw-v1";
var OG_EPC_NODES = [
  { code: "E", parentCode: null, title: { fa: "\u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering" }, typicalPct: 11, phase: "E" },
  { code: "E.1", parentCode: "E", title: { fa: "\u0645\u0647\u0646\u062F\u0633\u06CC \u067E\u0627\u06CC\u0647", en: "Basic engineering / FEED" }, typicalPct: 30, phase: "E" },
  { code: "E.2", parentCode: "E", title: { fa: "\u0645\u0647\u0646\u062F\u0633\u06CC \u062A\u0641\u0635\u06CC\u0644\u06CC", en: "Detailed engineering" }, typicalPct: 55, phase: "E" },
  { code: "E.3", parentCode: "E", title: { fa: "\u0645\u062F\u0627\u0631\u06A9 \u062D\u06CC\u0646 \u0633\u0627\u062E\u062A \u0648 \u0646\u0647\u0627\u06CC\u06CC", en: "As-built & final documentation" }, typicalPct: 15, phase: "E" },
  { code: "P", parentCode: null, title: { fa: "\u062A\u062F\u0627\u0631\u06A9\u0627\u062A", en: "Procurement" }, typicalPct: 45, phase: "P" },
  { code: "P.1", parentCode: "P", title: { fa: "\u0627\u0642\u0644\u0627\u0645 \u0628\u0644\u0646\u062F\u0633\u0641\u0627\u0631\u0634", en: "Long-lead items" }, typicalPct: 40, phase: "P" },
  { code: "P.2", parentCode: "P", title: { fa: "\u062A\u062C\u0647\u06CC\u0632\u0627\u062A \u062B\u0627\u0628\u062A \u0648 \u062F\u0648\u0627\u0631", en: "Static & rotating equipment" }, typicalPct: 30, phase: "P" },
  { code: "P.3", parentCode: "P", title: { fa: "\u0627\u0642\u0644\u0627\u0645 \u0627\u0646\u0628\u0648\u0647", en: "Bulk materials" }, typicalPct: 20, phase: "P" },
  { code: "P.4", parentCode: "P", title: { fa: "\u062D\u0645\u0644 \u0648 \u062A\u0631\u062E\u06CC\u0635", en: "Logistics & customs" }, typicalPct: 10, phase: "P" },
  { code: "C", parentCode: null, title: { fa: "\u0627\u062C\u0631\u0627", en: "Construction" }, typicalPct: 36, phase: "C" },
  { code: "C.1", parentCode: "C", title: { fa: "\u0627\u0628\u0646\u06CC\u0647 \u0648 \u0645\u062D\u0648\u0637\u0647", en: "Civil & infrastructure" }, typicalPct: 22, phase: "C" },
  { code: "C.2", parentCode: "C", title: { fa: "\u0645\u06A9\u0627\u0646\u06CC\u06A9 \u0648 \u0646\u0635\u0628 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", en: "Mechanical & equipment erection" }, typicalPct: 30, phase: "C" },
  { code: "C.3", parentCode: "C", title: { fa: "\u062E\u0637\u0648\u0637 \u0644\u0648\u0644\u0647 \u0648 \u067E\u0627\u06CC\u067E\u06CC\u0646\u06AF", en: "Piping & pipelines" }, typicalPct: 24, phase: "C" },
  { code: "C.4", parentCode: "C", title: { fa: "\u0628\u0631\u0642 \u0648 \u0627\u0628\u0632\u0627\u0631 \u062F\u0642\u06CC\u0642", en: "Electrical & instrumentation" }, typicalPct: 16, phase: "C" },
  { code: "C.5", parentCode: "C", title: { fa: "\u0631\u0646\u06AF\u060C \u0639\u0627\u06CC\u0642 \u0648 \u062D\u0641\u0627\u0638\u062A", en: "Painting, insulation & protection" }, typicalPct: 8, phase: "C" },
  { code: "CM", parentCode: null, title: { fa: "\u067E\u06CC\u0634\u200C\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0648 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", en: "Pre-commissioning & commissioning" }, typicalPct: 8, phase: "CM" },
  { code: "CM.1", parentCode: "CM", title: { fa: "\u067E\u06CC\u0634\u200C\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", en: "Pre-commissioning" }, typicalPct: 45, phase: "CM" },
  { code: "CM.2", parentCode: "CM", title: { fa: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0648 \u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A", en: "Commissioning & provisional acceptance" }, typicalPct: 40, phase: "CM" },
  { code: "CM.3", parentCode: "CM", title: { fa: "\u0622\u0645\u0648\u0632\u0634 \u0648 \u062A\u062D\u0648\u06CC\u0644 \u0646\u0647\u0627\u06CC\u06CC", en: "Training & final handover" }, typicalPct: 15, phase: "CM" }
];
var OG_DRILLING_NODES = [
  { code: "D", parentCode: null, title: { fa: "\u0622\u0645\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u0648 \u0628\u0633\u06CC\u062C", en: "Mobilisation & preparation" }, typicalPct: 10, phase: "C" },
  { code: "D.1", parentCode: "D", title: { fa: "\u0628\u0633\u06CC\u062C \u062F\u06A9\u0644 \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", en: "Rig & equipment mobilisation" }, typicalPct: 60, phase: "C" },
  { code: "D.2", parentCode: "D", title: { fa: "\u0622\u0645\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u0645\u062D\u0644 \u0648 \u0627\u06CC\u0645\u0646\u06CC", en: "Site preparation & HSE setup" }, typicalPct: 40, phase: "C" },
  { code: "W", parentCode: null, title: { fa: "\u0639\u0645\u0644\u06CC\u0627\u062A \u062F\u0631\u0648\u0646\u200C\u0686\u0627\u0647\u06CC", en: "Well operations" }, typicalPct: 60, phase: "C" },
  { code: "W.1", parentCode: "W", title: { fa: "\u06A9\u0634\u06CC\u062F\u0646 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0644\u0648\u0644\u0647 \u0645\u063A\u0632\u06CC", en: "Completion & tubing retrieval" }, typicalPct: 25, phase: "C" },
  { code: "W.2", parentCode: "W", title: { fa: "\u0628\u0631\u0634 \u0648 \u0645\u0627\u0647\u06CC\u06AF\u06CC\u0631\u06CC", en: "Cutting & fishing" }, typicalPct: 25, phase: "C" },
  { code: "W.3", parentCode: "W", title: { fa: "\u0633\u06CC\u0645\u0627\u0646\u200C\u06A9\u0627\u0631\u06CC \u0648 \u0622\u0632\u0645\u0648\u0646", en: "Cementing & testing" }, typicalPct: 25, phase: "C" },
  { code: "W.4", parentCode: "W", title: { fa: "\u062A\u06A9\u0645\u06CC\u0644 \u0645\u062C\u062F\u062F", en: "Re-completion" }, typicalPct: 25, phase: "C" },
  { code: "CP", parentCode: null, title: { fa: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u0627\u0636\u0637\u0631\u0627\u0631\u06CC", en: "Contingency plans" }, typicalPct: 20, phase: "C" },
  { code: "X", parentCode: null, title: { fa: "\u062C\u0645\u0639\u200C\u0622\u0648\u0631\u06CC \u0648 \u062A\u0631\u062E\u06CC\u0635", en: "Demobilisation" }, typicalPct: 10, phase: "CM" }
];
var OG_TEMPLATES = [
  {
    id: "og-epc",
    title: { fa: "EPC \u0639\u0645\u0648\u0645\u06CC \u0646\u0641\u062A\u060C \u06AF\u0627\u0632 \u0648 \u067E\u062A\u0631\u0648\u0634\u06CC\u0645\u06CC", en: "General oil, gas & petrochemical EPC" },
    note: { fa: "\u0686\u0647\u0627\u0631 \u0641\u0627\u0632 \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u0628\u0627 \u0634\u06A9\u0633\u062A \u0633\u0637\u062D \u062F\u0648. \u0633\u0637\u062D \u0633\u0647 \u0627\u0632 \u0645\u062A\u0646 \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u067E\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F.", en: "Four standard phases with level-2 breakdown." },
    nodes: OG_EPC_NODES
  },
  {
    id: "og-drilling",
    title: { fa: "\u062D\u0641\u0627\u0631\u06CC \u0648 \u062A\u0639\u0645\u06CC\u0631 \u0686\u0627\u0647", en: "Drilling & well intervention" },
    note: { fa: "\u0648\u0627\u062D\u062F \u0634\u06A9\u0633\u062A \xAB\u06AF\u0627\u0645 \u0631\u0648\u06CC\u0647\u200C\u0627\u06CC\xBB \u0627\u0633\u062A\u061B \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0627\u0636\u0637\u0631\u0627\u0631\u06CC \u0634\u0627\u062E\u0647\u0654 \u0645\u0633\u062A\u0642\u0644 \u062F\u0627\u0631\u062F.", en: "Procedural steps; contingency plans as a separate branch." },
    nodes: OG_DRILLING_NODES
  }
];
var TEMPLATE_BY_ID = new Map(OG_TEMPLATES.map((t) => [t.id, t]));
var OG_GLOSSARY = [
  { en: "tie-in", fa: "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u062E\u0637 \u0645\u0648\u062C\u0648\u062F (Tie-in)" },
  { en: "hook-up", fa: "\u0627\u062A\u0635\u0627\u0644 \u0646\u0647\u0627\u06CC\u06CC (Hook-up)" },
  { en: "long lead", fa: "\u0628\u0644\u0646\u062F\u0633\u0641\u0627\u0631\u0634" },
  { en: "punch list", fa: "\u0641\u0647\u0631\u0633\u062A \u0646\u0648\u0627\u0642\u0635 (Punch list)" },
  { en: "mechanical completion", fa: "\u062A\u06A9\u0645\u06CC\u0644 \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC" },
  { en: "pre-commissioning", fa: "\u067E\u06CC\u0634\u200C\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC" },
  { en: "commissioning", fa: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC" },
  { en: "provisional acceptance", fa: "\u062A\u062D\u0648\u06CC\u0644 \u0645\u0648\u0642\u062A" },
  { en: "final acceptance", fa: "\u062A\u062D\u0648\u06CC\u0644 \u0642\u0637\u0639\u06CC" },
  { en: "as-built", fa: "\u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A (As-built)" },
  { en: "shutdown", fa: "\u062A\u0648\u0642\u0641 \u062A\u0648\u0644\u06CC\u062F (Shutdown)" },
  { en: "turnaround", fa: "\u062A\u0639\u0645\u06CC\u0631\u0627\u062A \u0627\u0633\u0627\u0633\u06CC (Turnaround)" },
  { en: "workover", fa: "\u062A\u0639\u0645\u06CC\u0631 \u0686\u0627\u0647 (Workover)" },
  { en: "wellhead", fa: "\u0633\u0631\u0686\u0627\u0647\u06CC" },
  { en: "christmas tree", fa: "\u062F\u0631\u062E\u062A \u06A9\u0631\u06CC\u0633\u0645\u0633 (\u0634\u06CC\u0631\u0622\u0644\u0627\u062A \u0633\u0631\u0686\u0627\u0647\u06CC)" },
  { en: "casing", fa: "\u062C\u062F\u0627\u0631\u0647 (Casing)" },
  { en: "tubing", fa: "\u0644\u0648\u0644\u0647 \u0645\u063A\u0632\u06CC (Tubing)" },
  { en: "liner", fa: "\u0631\u0634\u062A\u0647\u0654 \u0622\u0648\u06CC\u0632 (Liner)" },
  { en: "packer", fa: "\u067E\u06A9\u0631" },
  { en: "fishing", fa: "\u0645\u0627\u0647\u06CC\u06AF\u06CC\u0631\u06CC (\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0627\u0628\u0632\u0627\u0631)" },
  { en: "coiled tubing", fa: "\u0644\u0648\u0644\u0647 \u0645\u063A\u0632\u06CC \u067E\u06CC\u0648\u0633\u062A\u0647 (CT)" },
  { en: "drilling fluid", fa: "\u0633\u06CC\u0627\u0644 \u062D\u0641\u0627\u0631\u06CC" },
  { en: "blowout preventer", fa: "\u0641\u0648\u0631\u0627\u0646\u200C\u06AF\u06CC\u0631 (BOP)" },
  { en: "flare", fa: "\u0641\u0644\u0631" },
  { en: "skid", fa: "\u0627\u0633\u06A9\u06CC\u062F" },
  { en: "spool", fa: "\u0627\u0633\u067E\u0648\u0644" },
  { en: "hydrotest", fa: "\u0622\u0632\u0645\u0648\u0646 \u0647\u06CC\u062F\u0631\u0648\u0627\u0633\u062A\u0627\u062A\u06CC\u06A9" },
  { en: "loop test", fa: "\u0622\u0632\u0645\u0648\u0646 \u062D\u0644\u0642\u0647 (Loop test)" },
  { en: "bill of quantities", fa: "\u0641\u0647\u0631\u0633\u062A \u0645\u0642\u0627\u062F\u06CC\u0631" },
  { en: "scope of work", fa: "\u062F\u0627\u0645\u0646\u0647\u0654 \u06A9\u0627\u0631" },
  { en: "lump sum", fa: "\u0645\u0642\u0637\u0648\u0639 (\u0644\u0627\u0645\u067E\u200C\u0633\u0627\u0645)" },
  { en: "milestone", fa: "\u0646\u0642\u0637\u0647\u0654 \u0639\u0637\u0641" },
  { en: "liquidated damages", fa: "\u062E\u0633\u0627\u0631\u062A \u062A\u0623\u062E\u06CC\u0631" },
  { en: "change order", fa: "\u062F\u0633\u062A\u0648\u0631 \u062A\u063A\u06CC\u06CC\u0631" },
  { en: "variation order", fa: "\u062F\u0633\u062A\u0648\u0631 \u06A9\u0627\u0631 \u0627\u0636\u0627\u0641\u06CC" }
];
function translationInstructions(targetLang) {
  const glossary = OG_GLOSSARY.map((g) => `${g.en} = ${g.fa}`).join("; ");
  const dir = targetLang === "fa" ? "\u0628\u0647 \u0641\u0627\u0631\u0633\u06CC" : "to English";
  return [
    `You are a specialist translator for oil, gas and petrochemical construction contracts. Translate ${dir}.`,
    "Hard rules:",
    "1. Never change numbers, dates, codes, clause numbers, units or currency symbols. Copy them exactly.",
    "2. Never summarise, merge or omit a sentence. A contract clause loses legal meaning when shortened.",
    "3. Keep the original clause numbering and line structure.",
    "4. For an industry term, use the glossary. Where a term has no settled equivalent, give the translation followed by the English in parentheses.",
    "5. If a passage is unreadable, output the original text unchanged rather than guessing.",
    `Glossary: ${glossary}`
  ].join("\n");
}
function wbsInstructions(templateId) {
  const tpl = templateId ? TEMPLATE_BY_ID.get(templateId) : null;
  const skeleton = tpl ? `Prefer this industry skeleton where the contract supports it: ${tpl.nodes.map((n) => `${n.code}=${n.title.en}`).join(", ")}.` : "Derive the structure from the contract itself.";
  return [
    "You extract a work breakdown structure from a construction contract in the oil and gas sector.",
    skeleton,
    "Hard rules:",
    "1. Every node must trace to a clause. Put the clause number in sourceRef.",
    "2. Never invent a quantity, rate or amount. If the contract does not state it, use null.",
    "3. Suggest a weight only when the contract or the scope implies relative effort; otherwise null.",
    "4. Do not exceed four levels.",
    "5. Output strict JSON: an array of objects with keys code, parentCode, titleFa, titleEn, weightPct, sourceRef."
  ].join("\n");
}
function detectGlossaryTerms(text) {
  const lower = String(text ?? "").toLowerCase();
  const out = [];
  for (const g of OG_GLOSSARY) {
    const needle = g.en.toLowerCase();
    let count = 0;
    let at = lower.indexOf(needle);
    while (at !== -1) {
      count += 1;
      at = lower.indexOf(needle, at + needle.length);
    }
    if (count > 0) out.push({ term: g.en, fa: g.fa, count });
  }
  return out.sort((a, b) => b.count - a.count);
}
function detectLanguage(text) {
  const s = String(text ?? "");
  const fa = (s.match(/[\u0600-\u06FF]/g) ?? []).length;
  const en = (s.match(/[A-Za-z]/g) ?? []).length;
  const total = fa + en;
  if (total < 10) return { lang: "unknown", faRatio: 0 };
  const ratio = Math.round(fa / total * 100) / 100;
  if (ratio >= 0.8) return { lang: "fa", faRatio: ratio };
  if (ratio <= 0.2) return { lang: "en", faRatio: ratio };
  return { lang: "mixed", faRatio: ratio };
}
var TEMPLATE_PROFILES = [
  {
    kind: "internal",
    title: { fa: "\u0642\u0627\u0644\u0628 \u062F\u0627\u062E\u0644\u06CC \u0633\u0627\u0632\u0645\u0627\u0646", en: "Internal template" },
    note: { fa: "\u0633\u062A\u0648\u0646\u200C\u0647\u0627 \u0642\u0627\u0628\u0644 \u0627\u0641\u0632\u0648\u062F\u0646 \u0627\u0633\u062A\u061B \u0645\u062E\u0627\u0637\u0628\u060C \u062A\u06CC\u0645 \u062F\u0627\u062E\u0644\u06CC \u067E\u0631\u0648\u0698\u0647.", en: "Columns can be extended; audience is the internal team." },
    editableColumns: true
  },
  {
    kind: "client",
    title: { fa: "\u0642\u0627\u0644\u0628 \u0627\u0628\u0644\u0627\u063A\u06CC \u06A9\u0627\u0631\u0641\u0631\u0645\u0627", en: "Client-issued template" },
    note: { fa: "\u0633\u062A\u0648\u0646\u200C\u0647\u0627 \u0642\u0641\u0644 \u0627\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u0633\u062A\u0648\u0646 \u06CC\u0639\u0646\u06CC \u0631\u062F \u0634\u062F\u0646 \u0641\u0627\u06CC\u0644 \u062A\u0648\u0633\u0637 \u06A9\u0627\u0631\u0641\u0631\u0645\u0627.", en: "Columns are locked; any change gets the file rejected." },
    editableColumns: false
  }
];
function profileOf(kind) {
  return TEMPLATE_PROFILES.find((p) => p.kind === kind) ?? TEMPLATE_PROFILES[0];
}
function seedFromTemplate(templateId) {
  const tpl = TEMPLATE_BY_ID.get(templateId);
  if (!tpl) return [];
  return tpl.nodes.map((n) => ({
    code: n.code,
    parentCode: n.parentCode,
    titleFa: n.title.fa,
    titleEn: n.title.en,
    weightPct: n.typicalPct,
    basis: "typical",
    sourceRefFa: null
  }));
}
function validateTemplate(templateId) {
  const tpl = TEMPLATE_BY_ID.get(templateId);
  if (!tpl) return { ok: false, issues: [`\u0642\u0627\u0644\u0628 \xAB${templateId}\xBB \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.`] };
  const issues = [];
  const parents = [...new Set(tpl.nodes.map((n) => n.parentCode))];
  for (const p of parents) {
    const kids = tpl.nodes.filter((n) => n.parentCode === p && n.typicalPct !== null);
    if (kids.length === 0) continue;
    const sum = Math.round(kids.reduce((s, k) => s + (k.typicalPct ?? 0), 0) * 100) / 100;
    if (Math.abs(sum - 100) > 0.01) {
      issues.push(`\u062C\u0645\u0639 \u062F\u0631\u0635\u062F \u0632\u06CC\u0631\u0634\u0627\u062E\u0647\u200C\u0647\u0627\u06CC \xAB${p ?? "\u0631\u06CC\u0634\u0647"}\xBB \u0628\u0631\u0627\u0628\u0631 ${sum} \u0627\u0633\u062A \u0646\u0647 \u06F1\u06F0\u06F0.`);
    }
  }
  return { ok: issues.length === 0, issues };
}
function offlineGlossaryTranslate(input) {
  const source = String(input ?? "");
  if (!source.trim()) return { text: "", replaced: 0, coveragePct: 0 };
  const terms = [...OG_GLOSSARY].sort((a, b) => b.en.length - a.en.length);
  let out = source;
  let replaced = 0;
  for (const g of terms) {
    const escaped = g.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?![\\p{L}\\p{N}])`, "giu");
    out = out.replace(re, (_m, pre) => {
      replaced += 1;
      return `${pre}${g.fa}`;
    });
  }
  const words = source.split(/\s+/).filter(Boolean).length || 1;
  return {
    text: out,
    replaced,
    coveragePct: Math.round(Math.min(100, replaced / words * 100) * 10) / 10
  };
}
export {
  OG_GLOSSARY,
  OG_TEMPLATES,
  OG_WBS_VERSION,
  TEMPLATE_BY_ID,
  TEMPLATE_PROFILES,
  detectGlossaryTerms,
  detectLanguage,
  offlineGlossaryTranslate,
  profileOf,
  seedFromTemplate,
  translationInstructions,
  validateTemplate,
  wbsInstructions
};
