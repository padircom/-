/**
 * سازندهٔ ساختار شکست لامپ‌سام — درخت، وزن توافقی و خروجی.
 *
 * این پنل مسیری را که کارفرما توصیف کرد پیاده می‌کند: مبلغ کل قرارداد
 * توافق شده و هزینهٔ هر بسته از درصد توافقی درمی‌آید، نه از متره.
 *
 * قاعده‌های نمایشی که عمداً رعایت شده‌اند:
 *
 * ۱. **گیت جمع وزن همیشه دیده می‌شود** — نه در یک کشوی بسته. کسری دو
 *    درصد در قراردادی با مبلغ ۱۶۷ هزار میلیون یعنی چند هزار میلیون
 *    گم‌شده، و آن نباید یک کلیک فاصله داشته باشد.
 *
 * ۲. **وزن تعیین‌نشده خالی نشان داده می‌شود نه صفر.** صفر ادعاست که
 *    بسته بی‌ارزش است؛ خالی اعتراف است که هنوز توافق نشده.
 *
 * ۳. **هیچ خروجی بدون پیش‌نمایش نیست** — قید صریح کارفرما. دکمهٔ
 *    خروجی نخست جدول را نشان می‌دهد، بعد دانلود.
 */

import { useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import {
  phasesFor,
  checkWeightSum,
  computeAbsoluteWeights,
  allocateCost,
  computeEarned,
  seedTypicalWeights,
  normalizeToHundred,
  roundPct,
  type LumpSumContractType,
  type WeightedNode,
} from "../services/lumpSumWeights";
import {
  buildSheet,
  buildXer,
  buildMspXml,
  exportFileName,
  columnsFor,
  type BreakdownView,
  type ExportNode,
  type Letterhead,
} from "../services/breakdownExport";

type Props = {
  lang: Lang;
  projectCode?: string;
  projectTitleFa?: string;
};

type Row = WeightedNode & { plannedPct?: number | null; actualPct?: number | null };

const VIEWS: { id: BreakdownView; fa: string; en: string }[] = [
  { id: "wbs", fa: "WBS ساختار کار", en: "WBS" },
  { id: "cbs", fa: "CBS ساختار هزینه", en: "CBS" },
  { id: "wpa", fa: "WPA لامپ‌سام", en: "WPA" },
  { id: "pms", fa: "PMS وزنی", en: "PMS" },
];

/** درخت پیش‌فرض: فازها در ریشه، ابنیه و مکانیک زیر اجرا. */
function seedRows(type: LumpSumContractType): Row[] {
  const phases = seedTypicalWeights(type) as Row[];
  return [
    ...phases,
    { code: "C.1", parentCode: "C", titleFa: "ابنیه", weightPct: 30, basis: "typical", sourceRefFa: null },
    { code: "C.2", parentCode: "C", titleFa: "مکانیک", weightPct: 70, basis: "typical", sourceRefFa: null },
  ];
}

const fmtMoney = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function BreakdownBuilder({ lang, projectCode = "PRJ", projectTitleFa = "پروژه" }: Props) {
  const rtl = lang === "fa";
  const [contractType, setContractType] = useState<LumpSumContractType>("EPCC");
  const [amount, setAmount] = useState<number>(167000);
  const [currency, setCurrency] = useState("MUSD");
  const [view, setView] = useState<BreakdownView>("wpa");
  const [rows, setRows] = useState<Row[]>(() => seedRows("EPCC"));
  const [preview, setPreview] = useState<{ title: string; head: string[]; body: (string | number | null)[][] } | null>(null);

  /* برگ‌ها تنها گره‌هایی هستند که تخصیص مبلغ می‌گیرند؛ شمردن والد و
   * فرزند با هم یعنی دو بار حساب کردن. */
  const leafCodes = useMemo(() => {
    const parents = new Set(rows.map((r) => r.parentCode).filter(Boolean) as string[]);
    return rows.filter((r) => !parents.has(r.code)).map((r) => r.code);
  }, [rows]);

  const abs = useMemo(() => computeAbsoluteWeights(rows), [rows]);
  const absByCode = useMemo(() => new Map(abs.map((a) => [a.code, a])), [abs]);

  const rootGate = useMemo(
    () => checkWeightSum(rows.filter((r) => !r.parentCode), amount),
    [rows, amount],
  );

  /* هر والد جداگانه سنجیده می‌شود: جمع فرزندان هر شاخه باید ۱۰۰ شود،
   * نه فقط جمع کل. یک شاخهٔ ناقص در جمع کل پنهان می‌ماند. */
  const branchGates = useMemo(() => {
    const parents = [...new Set(rows.map((r) => r.parentCode).filter(Boolean) as string[])];
    return parents.map((p) => ({
      parent: p,
      gate: checkWeightSum(rows.filter((r) => r.parentCode === p), amount),
    }));
  }, [rows, amount]);

  const alloc = useMemo(() => {
    const leaves = abs.filter((a) => leafCodes.includes(a.code));
    return allocateCost(leaves, amount);
  }, [abs, leafCodes, amount]);

  const amountByCode = useMemo(
    () => new Map(alloc.rows.map((r) => [r.code, r.amount])),
    [alloc],
  );

  const earned = useMemo(() => {
    const leaves = abs.filter((a) => leafCodes.includes(a.code));
    const progress = rows
      .filter((r) => r.actualPct !== null && r.actualPct !== undefined)
      .map((r) => ({ code: r.code, physicalPct: r.actualPct as number }));
    return computeEarned(leaves, progress, amount);
  }, [abs, leafCodes, rows, amount]);

  const allGatesOk = rootGate.ok && branchGates.every((b) => b.gate.ok);

  /* ── ویرایش ── */

  const setWeight = (code: string, raw: string) => {
    const v = raw.trim() === "" ? null : Number(raw);
    setRows((prev) =>
      prev.map((r) =>
        r.code === code
          ? { ...r, weightPct: v === null || Number.isNaN(v) ? null : roundPct(v), basis: "agreed" }
          : r,
      ),
    );
  };

  const setProgress = (code: string, raw: string) => {
    const v = raw.trim() === "" ? null : Math.min(100, Math.max(0, Number(raw)));
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, actualPct: Number.isNaN(v as number) ? null : v } : r)));
  };

  const changeType = (next: LumpSumContractType) => {
    setContractType(next);
    setRows(seedRows(next));
  };

  const normalizeBranch = (parent: string | null) => {
    const inBranch = rows.filter((r) => (r.parentCode ?? null) === parent);
    const fixed = normalizeToHundred(inBranch);
    const byCode = new Map(fixed.map((f) => [f.code, f]));
    setRows((prev) => prev.map((r) => (byCode.has(r.code) ? { ...r, ...byCode.get(r.code) } : r)));
  };

  /* ── خروجی ── */

  const letterhead: Letterhead = {
    projectCode,
    projectTitleFa,
    contractType,
    contractAmount: amount,
    currency,
    dataDate: new Date().toISOString().slice(0, 10),
    revision: "1",
    preparedBy: null,
  };

  const exportNodes = (): ExportNode[] =>
    rows.map((r) => {
      const a = absByCode.get(r.code);
      return {
        code: r.code,
        parentCode: r.parentCode ?? null,
        titleFa: r.titleFa,
        depth: a?.depth ?? 1,
        weightFactor: r.weightPct,
        weightValue: a?.weightValue ?? null,
        amount: amountByCode.get(r.code) ?? null,
        actualPct: r.actualPct ?? null,
        plannedPct: r.plannedPct ?? null,
        basis: r.basis,
        sourceRefFa: r.sourceRefFa ?? null,
      };
    });

  const showSheetPreview = () => {
    const sheet = buildSheet(view, exportNodes(), letterhead, [], lang);
    const head = columnsFor(view).map((c) => (rtl ? c.titleFa : c.titleEn));
    const body = sheet.rows.slice(sheet.headerRowIndex + 2);
    setPreview({ title: exportFileName(letterhead, view, "xlsx"), head, body });
  };

  const showTextPreview = (kind: "xer" | "xml") => {
    const text = kind === "xer" ? buildXer(exportNodes(), letterhead) : buildMspXml(exportNodes(), letterhead);
    setPreview({
      title: exportFileName(letterhead, view, kind),
      head: [kind === "xer" ? "XER — Primavera P6" : "XML — MS Project"],
      body: text.split("\n").map((l) => [l]),
    });
  };

  /* ── نمایش ── */

  const sorted = useMemo(() => {
    const out: Row[] = [];
    const roots = rows.filter((r) => !r.parentCode);
    const walk = (n: Row) => {
      out.push(n);
      rows.filter((c) => c.parentCode === n.code).forEach(walk);
    };
    roots.forEach(walk);
    for (const r of rows) if (!out.includes(r)) out.push(r);
    return out;
  }, [rows]);

  /* کلید نقشه رشتهٔ ساده است نه PhaseCode، چون با کد گره‌های دلخواه
   * (مثل «C.1») هم جست‌وجو می‌شود و آن‌ها در اتحادیهٔ فازها نیستند. */
  const phaseTitles = new Map<string, string>(
    phasesFor(contractType).map((p) => [String(p.code), rtl ? p.titleFa : p.titleEn]),
  );

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="fade-rise space-y-2">
      {/* ── نوار قرارداد ── */}
      <div className="glass-dark flex flex-wrap items-center gap-3 rounded-2xl p-3 text-[10px]">
        <span className="tx3">{rtl ? "نوع قرارداد" : "Contract"}</span>
        {(["EPC", "EPCC"] as LumpSumContractType[]).map((ct) => (
          <button
            key={ct}
            onClick={() => changeType(ct)}
            className={`rounded-lg px-2.5 py-1 text-[9.5px] transition ${contractType === ct ? "toggle-on tx1" : "border b-line-soft tx3"}`}
          >
            {ct}
          </button>
        ))}

        <span className="ms-2 tx3">{rtl ? "مبلغ کل" : "Contract value"}</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          className="w-32 rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1 text-[10px] tabular-nums tx1 outline-none focus:border-[var(--accent)]"
          dir="ltr"
        />
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-16 rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1 text-[10px] tx2 outline-none"
          dir="ltr"
        />

        <div className="ms-auto flex flex-wrap items-center gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-lg px-2 py-1 text-[9px] transition ${view === v.id ? "toggle-on tx1" : "border b-line-soft tx3"}`}
            >
              {rtl ? v.fa : v.en}
            </button>
          ))}
        </div>
      </div>

      {/* ── گیت جمع وزن ── */}
      <div
        className="glass-dark rounded-2xl p-3"
        style={{ borderColor: allGatesOk ? "rgba(110,231,183,.45)" : "rgba(255,159,159,.5)" }}
      >
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className={allGatesOk ? "ok-t" : "text-rose-300"}>{allGatesOk ? "✓" : "⚠"}</span>
          <span className="tx1">
            {rtl ? "جمع درصد فازها" : "Phase weight sum"}: <b dir="ltr">{rootGate.sum}</b>
          </span>
          {!rootGate.ok && rootGate.messageFa && <span className="text-rose-300">{rootGate.messageFa}</span>}
          {!rootGate.ok && Math.abs(rootGate.deltaAmount) > 0 && (
            <span className="text-rose-300" dir="ltr">
              Δ {fmtMoney(Math.abs(rootGate.deltaAmount))} {currency}
            </span>
          )}
          {!rootGate.ok && (
            <button onClick={() => normalizeBranch(null)} className="connect-btn rounded-lg px-2 py-0.5 text-[9px]">
              {rtl ? "نرمال‌سازی به ۱۰۰" : "Normalize to 100"}
            </button>
          )}
        </div>

        {branchGates.filter((b) => !b.gate.ok).map((b) => (
          <div key={b.parent} className="mt-1 flex flex-wrap items-center gap-2 text-[9.5px] text-rose-300">
            <span>⚠ {rtl ? "زیرشاخهٔ" : "Branch"} {b.parent}: {b.gate.sum}</span>
            <span>{b.gate.messageFa}</span>
            <button onClick={() => normalizeBranch(b.parent)} className="connect-btn rounded-lg px-2 py-0.5 text-[9px]">
              {rtl ? "نرمال‌سازی" : "Normalize"}
            </button>
          </div>
        ))}

        {alloc.warningsFa.map((w) => (
          <div key={w} className="mt-1 text-[9.5px] text-amber-300">⚠ {w}</div>
        ))}
        {earned.unweightedCodes.length > 0 && (
          <div className="mt-1 text-[9.5px] text-amber-300">
            ⚠ {rtl ? "پیشرفت بدون وزن (در عدد کل دیده نمی‌شود)" : "Progress on unweighted packages"}: {earned.unweightedCodes.join("، ")}
          </div>
        )}
      </div>

      {/* ── جدول درخت ── */}
      <div className="glass-dark overflow-x-auto rounded-2xl p-2">
        <table className="w-full min-w-[760px] border-collapse text-[10px]">
          <thead>
            <tr className="border-b b-line-soft text-[9px] tx3">
              <th className="px-2 py-2 text-start">{rtl ? "کد" : "Code"}</th>
              <th className="px-2 py-2 text-start">{rtl ? "شرح" : "Description"}</th>
              <th className="px-2 py-2 text-center">WF%</th>
              <th className="px-2 py-2 text-center">WV%</th>
              <th className="px-2 py-2 text-end">{rtl ? "مبلغ" : "Amount"}</th>
              <th className="px-2 py-2 text-center">{rtl ? "پیشرفت" : "Actual"}</th>
              <th className="px-2 py-2 text-center">{rtl ? "مبنا" : "Basis"}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const a = absByCode.get(r.code);
              const isLeaf = leafCodes.includes(r.code);
              const amt = amountByCode.get(r.code);
              return (
                <tr key={r.code} className="border-b b-line-soft last:border-0">
                  <td className="px-2 py-1.5 font-mono tx2" dir="ltr" style={{ paddingInlineStart: `${((a?.depth ?? 1) - 1) * 14 + 8}px` }}>
                    {r.code}
                  </td>
                  <td className="px-2 py-1.5 tx1">{phaseTitles.get(r.code) ?? r.titleFa}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      value={r.weightPct ?? ""}
                      onChange={(e) => setWeight(r.code, e.target.value)}
                      placeholder="—"
                      className="w-16 rounded border b-line-soft bg-[var(--row)] px-1 py-0.5 text-center text-[9.5px] tabular-nums tx1 outline-none focus:border-[var(--accent)]"
                      dir="ltr"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums tx3" dir="ltr">{a ? a.weightValue : "—"}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums" dir="ltr">
                    {isLeaf && amt !== undefined ? <span className="tx1">{fmtMoney(amt)}</span> : <span className="tx4">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {isLeaf ? (
                      <input
                        value={r.actualPct ?? ""}
                        onChange={(e) => setProgress(r.code, e.target.value)}
                        placeholder="—"
                        className="w-14 rounded border b-line-soft bg-[var(--row)] px-1 py-0.5 text-center text-[9.5px] tabular-nums tx1 outline-none focus:border-[var(--accent)]"
                        dir="ltr"
                      />
                    ) : (
                      <span className="tx4">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center text-[8.5px]">
                    <span className={r.basis === "agreed" ? "ok-dim-t" : r.basis === "typical" ? "text-amber-300" : "tx4"}>
                      {r.basis === "agreed" ? (rtl ? "توافقی" : "agreed")
                        : r.basis === "typical" ? (rtl ? "پیشنهادی" : "typical")
                        : r.basis === "derived" ? (rtl ? "مشتق" : "derived")
                        : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t b-line text-[10px]">
              <td className="px-2 py-2 tx3" colSpan={4}>{rtl ? "جمع تخصیص‌یافته" : "Allocated"}</td>
              <td className="px-2 py-2 text-end tabular-nums tx1" dir="ltr">{fmtMoney(alloc.allocated)}</td>
              <td className="px-2 py-2 text-center tabular-nums" dir="ltr" style={{ color: "#8FE3C8" }}>{earned.overallPct}%</td>
              <td className="px-2 py-2 text-center text-[8.5px] tx4">
                {alloc.roundingFixApplied !== 0 && (rtl ? `جبران ${alloc.roundingFixApplied}` : `fix ${alloc.roundingFixApplied}`)}
              </td>
            </tr>
            <tr className="text-[9.5px] tx3">
              <td className="px-2 pb-2" colSpan={4}>{rtl ? "ارزش کسب‌شده" : "Earned value"}</td>
              <td className="px-2 pb-2 text-end tabular-nums ok-t" dir="ltr">{fmtMoney(earned.earnedAmount)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── خروجی ── */}
      <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[10px]">
        <span className="tx3">{rtl ? "خروجی" : "Export"}</span>
        <button onClick={showSheetPreview} className="connect-btn rounded-lg px-2.5 py-1 text-[9.5px]">
          {rtl ? "اکسل (پیش‌نمایش)" : "Excel (preview)"}
        </button>
        <button onClick={() => showTextPreview("xer")} className="connect-btn rounded-lg px-2.5 py-1 text-[9.5px]">
          XER · P6
        </button>
        <button onClick={() => showTextPreview("xml")} className="connect-btn rounded-lg px-2.5 py-1 text-[9.5px]">
          XML · MSP
        </button>
        {!allGatesOk && (
          <span className="text-[9px] text-amber-300">
            {rtl ? "وزن‌ها هنوز ۱۰۰ نشده‌اند؛ خروجی ناقص خواهد بود." : "Weights do not sum to 100 yet."}
          </span>
        )}
        <span className="ms-auto text-[8.5px] tx4">
          {rtl ? "هیچ فایلی بدون پیش‌نمایش خارج نمی‌شود" : "No file leaves without a preview"}
        </span>
      </div>

      {/* ── پیش‌نمایش ── */}
      {preview !== null && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] tx1">{rtl ? "پیش‌نمایش خروجی" : "Export preview"}</span>
            <span className="font-mono text-[9px] tx3" dir="ltr">{preview.title}</span>
            <button onClick={() => setPreview(null)} className="ms-auto rounded-lg border b-line-soft px-2 py-0.5 text-[9px] tx3 hover:tx1">
              {rtl ? "بستن" : "Close"}
            </button>
          </div>
          <div className="thin-scroll max-h-72 overflow-auto rounded-xl border b-line-soft bg-black/10 p-2">
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="border-b b-line-soft tx3">
                  {preview.head.map((h, i) => <th key={i} className="px-1.5 py-1 text-start whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.body.map((r, i) => (
                  <tr key={i} className="border-b b-line-soft last:border-0">
                    {r.map((c, j) => (
                      <td key={j} className="px-1.5 py-1 tx2 whitespace-nowrap" dir={typeof c === "number" ? "ltr" : undefined}>
                        {c === null || c === undefined || c === "" ? <span className="tx4">—</span> : String(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[8.5px] tx4">
            {rtl
              ? `${preview.body.length} سطر · مبلغ‌ها از وزن مطلق محاسبه شده‌اند، نه از متره.`
              : `${preview.body.length} rows · amounts derived from absolute weights.`}
          </p>
        </div>
      )}
    </div>
  );
}
