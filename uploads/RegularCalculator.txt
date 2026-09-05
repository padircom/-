import { useState, useCallback } from "react";
import { type Lang } from "../data/framework";

type Props = { lang: Lang };

type HistoryRow = { expr: string; result: string; time: string };

export default function RegularCalculator({ lang }: Props) {
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [pending, setPending] = useState(false);

  const add = useCallback(
    (token: string) => {
      setDisplay((prev) => {
        if (pending) {
          setPending(false);
          return token === "." ? "0." : token;
        }
        return prev === "0" && token !== "." ? token : prev + token;
      });
    },
    [pending]
  );

  const applyOp = useCallback(
    (op: string) => {
      setExpr((current) => {
        // Replace the previous operator instead of creating an invalid expression.
        if (pending && current) return current.replace(/[+\-*/]$/, op);
        return `${current || display}${op}`;
      });
      setPending(true);
    },
    [display, pending]
  );

  const equals = useCallback(() => {
    try {
      const calc = expr + display;
      const result = String(Function(`"use strict"; return (${calc.replace(/[^0-9+\-*/.()]/g, "")})`)());
      setHistory((h) => [
        { expr: calc, result: result.replace(".", lang === "fa" ? "," : "."), time: new Date().toLocaleTimeString(lang === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" }) },
        ...h.slice(0, 6),
      ]);
      setDisplay(result);
      setExpr("");
      setPending(true);
    } catch {
      setDisplay("خطا");
    }
  }, [expr, display, lang]);

  const clearAll = () => {
    setDisplay("0");
    setExpr("");
    setHistory([]);
    setPending(false);
  };

  const backspace = () => {
    if (pending) return;
    setDisplay((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
  };

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-4">
      <h2 className="mb-3 text-[15px] font-normal tx1">{lang === "fa" ? "ماشین حساب عمومی" : "Regular Calculator"}</h2>

      <div className="mb-2 rounded-xl bg-[rgba(255,255,255,0.04)] px-3 py-3 text-right text-[22px] font-light tracking-wide tabular-nums break-all tx1 shadow-inner">
        {display}
      </div>
      <div className="h-1 w-full rounded-full bg-gradient-to-r from-transparent via-[var(--line-soft)] to-transparent" />

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {["C", "⌫", "%", "/"].map((v) => (
          <button key={v} onClick={() => {
            if (v === "C") clearAll();
            else if (v === "⌫") backspace();
            else if (v === "%") {
              setDisplay((current) => String((Number(current) || 0) / 100));
              setPending(false);
            }
            else applyOp(v);
          }} className="rounded-xl border border-[var(--line-soft)] bg-[var(--chip-bg)] px-2 py-3 text-[13px] text-rose-400 transition hover:bg-[var(--row-hover)]">{v}</button>
        ))}
        {["7", "8", "9", "*"].map((v) => (<button key={v} onClick={() => v === "*" ? applyOp("*") : add(v)} className="rounded-xl border border-[var(--line-soft)] bg-[var(--chip-bg)] px-2 py-3 text-[15px] font-light tx1 transition hover:bg-[var(--row-hover)]">{v}</button>))}
        {["4", "5", "6", "-"].map((v) => (<button key={v} onClick={() => v === "-" ? applyOp("-") : add(v)} className="rounded-xl border border-[var(--line-soft)] bg-[var(--chip-bg)] px-2 py-3 text-[15px] font-light tx1 transition hover:bg-[var(--row-hover)]">{v}</button>))}
        {["1", "2", "3", "+"].map((v) => (<button key={v} onClick={() => v === "+" ? applyOp("+") : add(v)} className="rounded-xl border border-[var(--line-soft)] bg-[var(--chip-bg)] px-2 py-3 text-[15px] font-light tx1 transition hover:bg-[var(--row-hover)]">{v}</button>))}
        {["0", ".", "="].map((v) => (
          <button
            key={v}
            onClick={() => {
              if (v === "=") equals();
              else add(v);
            }}
            className={`rounded-xl border px-2 py-3 text-[15px] font-light transition hover:bg-[var(--row-hover)] ${
              v === "=" ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : "border-[var(--line-soft)] bg-[var(--chip-bg)] tx1"
            }`}
          >
            {v === "=" ? (lang === "fa" ? "=" : "=") : v}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto rounded-xl bg-[rgba(255,255,255,0.03)] px-2.5 py-2.5">
        <div className="mb-1.5 text-[9px] font-extralight tracking-wide tx4">{lang === "fa" ? "تاریخچه محاسبات" : "History"}</div>
        <div className="space-y-0.5">
          {history.length === 0 ? (
            <div className="text-[9px] font-extralight text-[var(--ink4)]">—</div>
          ) : (
            history.map((h) => (
              <div key={h.time} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 hover:bg-[rgba(255,255,255,0.05)]">
                <div className="truncate text-[10px] font-light text-[var(--ink3)]">{h.expr}</div>
                <div className="text-[11px] font-light tabular-nums text-[var(--ink2)]">{h.result}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
