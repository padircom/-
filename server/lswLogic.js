// src/services/lumpSumWeights.ts
var LUMPSUM_VERSION = "lsw-v1";
var EPC_PHASES = [
  { code: "E", titleFa: "\u0645\u0647\u0646\u062F\u0633\u06CC", titleEn: "Engineering", typicalPct: 12 },
  { code: "P", titleFa: "\u062A\u062F\u0627\u0631\u06A9\u0627\u062A", titleEn: "Procurement", typicalPct: 48 },
  { code: "C", titleFa: "\u0627\u062C\u0631\u0627", titleEn: "Construction", typicalPct: 40 }
];
var EPCC_PHASES = [
  { code: "E", titleFa: "\u0645\u0647\u0646\u062F\u0633\u06CC", titleEn: "Engineering", typicalPct: 11 },
  { code: "P", titleFa: "\u062A\u062F\u0627\u0631\u06A9\u0627\u062A", titleEn: "Procurement", typicalPct: 45 },
  { code: "C", titleFa: "\u0627\u062C\u0631\u0627", titleEn: "Construction", typicalPct: 36 },
  { code: "CM", titleFa: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", titleEn: "Commissioning", typicalPct: 8 }
];
function phasesFor(type) {
  return type === "EPCC" ? EPCC_PHASES : EPC_PHASES;
}
function roundMoney(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
}
function roundPct(n) {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}
var WEIGHT_SUM_TOLERANCE = 0.01;
function checkWeightSum(nodes, contractAmount = 0) {
  const withValue = nodes.filter((n) => n.weightPct !== null && n.weightPct !== void 0);
  const missingCount = nodes.length - withValue.length;
  const sum = roundPct(withValue.reduce((s, n) => s + n.weightPct, 0));
  const deltaPct = roundPct(sum - 100);
  const deltaAmount = roundMoney(deltaPct / 100 * contractAmount);
  if (nodes.length === 0) {
    return { ok: false, sum: 0, deltaPct: -100, deltaAmount: roundMoney(-contractAmount), missingCount: 0, messageFa: "\u0647\u06CC\u0686 \u0628\u0633\u062A\u0647\u200C\u0627\u06CC \u062A\u0639\u0631\u06CC\u0641 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  if (missingCount > 0) {
    return {
      ok: false,
      sum,
      deltaPct,
      deltaAmount,
      missingCount,
      messageFa: `${missingCount} \u0628\u0633\u062A\u0647 \u0647\u0646\u0648\u0632 \u062F\u0631\u0635\u062F \u062A\u0648\u0627\u0641\u0642\u06CC \u0646\u062F\u0627\u0631\u062F.`
    };
  }
  if (Math.abs(deltaPct) > WEIGHT_SUM_TOLERANCE) {
    const dir = deltaPct > 0 ? "\u0628\u06CC\u0634 \u0627\u0632" : "\u06A9\u0645\u062A\u0631 \u0627\u0632";
    return {
      ok: false,
      sum,
      deltaPct,
      deltaAmount,
      missingCount: 0,
      messageFa: `\u062C\u0645\u0639 \u062F\u0631\u0635\u062F\u0647\u0627 ${sum} \u0627\u0633\u062A \u2014 ${dir} \u06F1\u06F0\u06F0. \u0627\u062E\u062A\u0644\u0627\u0641 \u0645\u0639\u0627\u062F\u0644 ${Math.abs(deltaAmount).toLocaleString("fa-IR")} \u0627\u0632 \u0645\u0628\u0644\u063A \u0642\u0631\u0627\u0631\u062F\u0627\u062F.`
    };
  }
  return { ok: true, sum, deltaPct, deltaAmount, missingCount: 0, messageFa: null };
}
function computeAbsoluteWeights(nodes) {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const cache = /* @__PURE__ */ new Map();
  const resolve = (code, guard) => {
    const hit = cache.get(code);
    if (hit) return hit;
    const node = byCode.get(code);
    if (!node) return { wv: 0, depth: 0 };
    if (guard.has(code)) return { wv: 0, depth: 0 };
    guard.add(code);
    const wf = node.weightPct ?? 0;
    if (!node.parentCode) {
      const out2 = { wv: roundPct(wf), depth: 1 };
      cache.set(code, out2);
      return out2;
    }
    const parent = resolve(node.parentCode, guard);
    const out = { wv: roundPct(wf * parent.wv / 100), depth: parent.depth + 1 };
    cache.set(code, out);
    return out;
  };
  return nodes.map((n) => {
    const r = resolve(n.code, /* @__PURE__ */ new Set());
    return { code: n.code, weightFactor: roundPct(n.weightPct ?? 0), weightValue: r.wv, depth: r.depth };
  });
}
function allocateCost(weights, contractAmount, digits = 2) {
  const warningsFa = [];
  if (!(contractAmount > 0)) {
    return { rows: [], allocated: 0, roundingFixApplied: 0, warningsFa: ["\u0645\u0628\u0644\u063A \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A."] };
  }
  const sumWv = roundPct(weights.reduce((s, w) => s + w.weightValue, 0));
  if (Math.abs(sumWv - 100) > WEIGHT_SUM_TOLERANCE) {
    warningsFa.push(`\u062C\u0645\u0639 \u0648\u0632\u0646 \u0645\u0637\u0644\u0642 ${sumWv} \u0627\u0633\u062A \u0646\u0647 \u06F1\u06F0\u06F0\u061B \u0627\u062D\u062A\u0645\u0627\u0644\u0627\u064B \u06AF\u0631\u0647\u200C\u0647\u0627\u06CC \u0645\u06CC\u0627\u0646\u06CC \u0647\u0645 \u0634\u0645\u0631\u062F\u0647 \u0634\u062F\u0647\u200C\u0627\u0646\u062F.`);
  }
  const rows = weights.map((w) => ({
    code: w.code,
    weightValue: w.weightValue,
    amount: roundMoney(w.weightValue / 100 * contractAmount, digits)
  }));
  const allocatedRaw = roundMoney(rows.reduce((s, r) => s + r.amount, 0), digits);
  let fix = 0;
  if (rows.length > 0 && Math.abs(sumWv - 100) <= WEIGHT_SUM_TOLERANCE) {
    fix = roundMoney(contractAmount - allocatedRaw, digits);
    if (fix !== 0) {
      let biggest = 0;
      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].amount > rows[biggest].amount) biggest = i;
      }
      rows[biggest].amount = roundMoney(rows[biggest].amount + fix, digits);
    }
  }
  return {
    rows,
    allocated: roundMoney(rows.reduce((s, r) => s + r.amount, 0), digits),
    roundingFixApplied: fix,
    warningsFa
  };
}
function computeEarned(weights, progress, contractAmount) {
  const wvByCode = new Map(weights.map((w) => [w.code, w.weightValue]));
  const unweightedCodes = [];
  let acc = 0;
  for (const p of progress) {
    const wv = wvByCode.get(p.code);
    const pct = Math.min(100, Math.max(0, p.physicalPct));
    if (wv === void 0 || wv === 0) {
      if (pct > 0) unweightedCodes.push(p.code);
      continue;
    }
    acc += wv * pct / 100;
  }
  const overallPct = roundPct(acc);
  return {
    overallPct,
    earnedAmount: roundMoney(overallPct / 100 * contractAmount),
    unweightedCodes
  };
}
function seedTypicalWeights(type) {
  return phasesFor(type).map((p) => ({
    code: p.code,
    parentCode: null,
    titleFa: p.titleFa,
    weightPct: p.typicalPct,
    basis: "typical",
    sourceRefFa: null
  }));
}
function normalizeToHundred(nodes) {
  const withValue = nodes.filter((n) => n.weightPct !== null);
  const sum = withValue.reduce((s, n) => s + n.weightPct, 0);
  if (sum <= 0) return nodes;
  return nodes.map((n) => {
    if (n.weightPct === null) return n;
    const scaled = roundPct(n.weightPct * 100 / sum);
    return scaled === n.weightPct ? n : { ...n, weightPct: scaled, basis: "derived" };
  });
}
export {
  EPCC_PHASES,
  EPC_PHASES,
  LUMPSUM_VERSION,
  WEIGHT_SUM_TOLERANCE,
  allocateCost,
  checkWeightSum,
  computeAbsoluteWeights,
  computeEarned,
  normalizeToHundred,
  phasesFor,
  roundMoney,
  roundPct,
  seedTypicalWeights
};
