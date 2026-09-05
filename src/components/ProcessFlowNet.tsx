import { useMemo, useState } from "react";
import { dataSources, domains, t, type Lang, type Process, type SubProcess } from "../data/framework";

type Node = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "src" | "dom" | "proc" | "out";
  accent: string;
  label: { fa: string; en: string };
  domainId?: string;
  process?: Process;
  sub?: SubProcess;
  muted?: boolean;
};

const LIVE = ["d7", "d1", "d2", "d3", "d5", "d6"] as const;
const LANE_H = 86;
const LEFT = 168;
const BOX_W = 136;
const BOX_H = 40;
const GAP = 22;

function build(): { nodes: Node[]; w: number; h: number } {
  const nodes: Node[] = [];
  let maxX = 900;

  dataSources.forEach((s, i) => {
    const x = LEFT + i * (114 + 14);
    nodes.push({
      id: `src-${s.id}`,
      x,
      y: 22,
      w: 114,
      h: 34,
      kind: "src",
      accent: s.color,
      label: { fa: s.name, en: s.name },
    });
    maxX = Math.max(maxX, x + 114);
  });

  LIVE.forEach((did, li) => {
    const d = domains.find((x) => x.id === did);
    if (!d) return;
  const y = 88 + li * LANE_H;
    nodes.push({
      id: did,
      x: 14,
      y: y + 6,
      w: 148,
      h: 46,
      kind: "dom",
      accent: d.accent,
      label: d.title,
      domainId: did,
    });
    d.processes.forEach((p, i) => {
      const x = LEFT + i * (BOX_W + GAP);
      nodes.push({
        id: p.id,
        x,
        y,
        w: BOX_W,
        h: BOX_H,
        kind: "proc",
        accent: d.accent,
        label: p.title,
        domainId: did,
        process: p,
        sub: p.subs[0],
      });
      maxX = Math.max(maxX, x + BOX_W);
    });
  });

  const outY = 88 + LIVE.length * LANE_H + 16;
  [
    { id: "out-lock", fa: "قفل DataDate", en: "DataDate lock", accent: "#7FB2FF" },
    { id: "out-rpt", fa: "۱۴ گزارش / EXEC", en: "14 RPT / EXEC", accent: "#FFD48A" },
    { id: "out-cls", fa: "اختتام پروژه", en: "Close-out", accent: "#C9A7FF" },
  ].forEach((o, i) => {
    nodes.push({
      id: o.id,
      x: LEFT + i * (BOX_W + GAP),
      y: outY,
      w: BOX_W,
      h: BOX_H,
      kind: "out",
      accent: o.accent,
      label: { fa: o.fa, en: o.en },
    });
  });
  nodes.push({
    id: "d4",
    x: 14,
    y: outY,
    w: 148,
    h: 46,
    kind: "dom",
    accent: "#64748B",
    label: { fa: "ریسک/ادعا — فاز بعد", en: "Risk/claims — later" },
    domainId: "d4",
    muted: true,
  });

  return { nodes, w: maxX + 36, h: outY + 64 };
}

const BUILT = build();
const NODES = BUILT.nodes;

function nd(id: string) {
  return NODES.find((n) => n.id === id);
}
function mid(n: Node) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

type Link = { a: string; b: string; dash?: boolean };

function buildLinks(): Link[] {
  const L: Link[] = [];
  LIVE.forEach((did) => {
    const d = domains.find((x) => x.id === did);
    if (!d?.processes.length) return;
    L.push({ a: did, b: d.processes[0].id });
    d.processes.forEach((p, i) => {
      if (i) L.push({ a: d.processes[i - 1].id, b: p.id });
    });
  });
  L.push({ a: "src-p6", b: "d2-p2", dash: true });
  L.push({ a: "src-msp", b: "d2-p2", dash: true });
  L.push({ a: "src-sap", b: "d5-p2", dash: true });
  L.push({ a: "src-dms", b: "d1-p1", dash: true });
  L.push({ a: "src-iot", b: "d2-p4", dash: true });
  L.push({ a: "src-pbi", b: "d3-p6", dash: true });
  L.push({ a: "d7-p2", b: "d1", dash: true });
  L.push({ a: "d7-p2", b: "d2", dash: true });
  L.push({ a: "d1-p4", b: "d2-p2", dash: true });
  L.push({ a: "d2-p4", b: "d3-p2", dash: true });
  L.push({ a: "d2-p6", b: "d3-p6", dash: true });
  L.push({ a: "d5-p2", b: "d3-p2", dash: true });
  L.push({ a: "d3-p6", b: "out-rpt" });
  L.push({ a: "d3-p3", b: "out-lock", dash: true });
  L.push({ a: "d6-p5", b: "out-rpt", dash: true });
  L.push({ a: "out-lock", b: "out-rpt" });
  L.push({ a: "out-rpt", b: "out-cls" });
  L.push({ a: "d1-p5", b: "out-cls", dash: true });
  return L.filter((l) => nd(l.a) && nd(l.b));
}

const LINKS = buildLinks();

function path(a: Node, b: Node) {
  const s = mid(a);
  const e = mid(b);
  const sameLane = Math.abs(s.y - e.y) < 8;
  if (sameLane) {
    const y = s.y;
    const x1 = a.x + a.w;
    const x2 = b.x;
    return `M ${x1} ${y} H ${x2}`;
  }
  const start = { x: a.x + a.w / 2, y: a.y + a.h };
  const end = { x: b.x + b.w / 2, y: b.y };
  const my = (start.y + end.y) / 2;
  return `M ${start.x} ${start.y} V ${my} H ${end.x} V ${end.y}`;
}

function inspector(n: Node, lang: Lang) {
  const d = n.domainId ? domains.find((x) => x.id === n.domainId) : undefined;
  const sub = n.sub;
  return {
    title: t(n.label, lang),
    domain: d ? t(d.title, lang) : n.kind === "src" ? (lang === "fa" ? "منبع داده" : "Data source") : "",
    activity: sub ? t(sub.activity, lang) : "",
    source: sub?.source ?? "",
    sql: sub?.sql?.join(" · ") ?? "",
    output: sub?.output ?? "",
    to: sub?.connectsTo ?? "",
    ai: sub?.ai ?? "",
  };
}

export default function ProcessFlowNet({ lang, onBack }: { lang: Lang; onBack?: () => void }) {
  const rtl = lang === "fa";
  const [sel, setSel] = useState("d3-p2");
  const node = nd(sel) ?? NODES.find((n) => n.kind === "proc")!;
  const related = useMemo(() => {
    const s = new Set<string>([sel]);
    LINKS.forEach((l) => {
      if (l.a === sel || l.b === sel) {
        s.add(l.a);
        s.add(l.b);
      }
    });
    return s;
  }, [sel]);
  const info = inspector(node, lang);

  return (
    <div className="glass relative flex min-h-0 flex-1 overflow-hidden rounded-2xl">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-1.5" dir={rtl ? "rtl" : "ltr"}>
          {onBack && (
            <button type="button" onClick={onBack} className="glass-row rounded-lg px-2.5 py-1.5 text-[10px] tx2">
              {rtl ? "بازگشت به رینگ" : "Back"}
            </button>
          )}
          <div className="text-[12px] font-light tx1">{rtl ? "نقشه حیات داده — باند افقی هر ماژول" : "Data-life map — one lane per module"}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <svg viewBox={`0 0 ${BUILT.w} ${BUILT.h}`} className="h-full w-full" preserveAspectRatio="xMinYMin meet" role="img">
            <defs>
              {Array.from(new Set(NODES.map((n) => n.accent))).map((c) => (
                <marker key={c} id={`arr-${c.replace("#", "")}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill={c} />
                </marker>
              ))}
            </defs>
            {LIVE.map((did, i) => {
              const d = domains.find((x) => x.id === did)!;
              const y = 88 + i * LANE_H - 10;
              return <rect key={did} x={8} y={y} width={BUILT.w - 16} height={LANE_H - 8} rx="16" fill={d.accent} opacity="0.05" />;
            })}
            {LINKS.map((l, i) => {
              const A = nd(l.a);
              const B = nd(l.b);
              if (!A || !B) return null;
              const color = A.accent;
              const midId = `arr-${color.replace("#", "")}`;
              const hot = l.a === sel || l.b === sel;
              const d = path(A, B);
              return (
                <g key={i} opacity={hot ? 1 : 0.55}>
                  <path d={d} fill="none" stroke={color} strokeWidth={hot ? 2 : 1.35} strokeDasharray={l.dash ? "6 10" : "11 13"} strokeLinecap="round" markerEnd={`url(#${midId})`}>
                    <animate attributeName="stroke-dashoffset" from="80" to="0" dur={`${2.4 + (i % 5) * 0.3}s`} repeatCount="indefinite" />
                  </path>
                </g>
              );
            })}
            {NODES.map((n) => {
              const isSel = n.id === sel;
              const on = related.has(n.id);
              return (
                <g key={n.id} opacity={n.muted ? 0.35 : on ? 1 : 0.55} onClick={() => !n.muted && setSel(n.id)} style={{ cursor: n.muted ? "default" : "pointer" }}>
                  <foreignObject x={n.x} y={n.y} width={n.w} height={n.h}>
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      dir={rtl ? "rtl" : "ltr"}
                      className={`flex h-full w-full items-center justify-center rounded-xl px-2 text-center ${n.kind === "dom" || isSel ? "glass" : "glass-row"}`}
                      style={{
                        borderColor: n.accent,
                        boxShadow: isSel ? `0 0 18px -4px ${n.accent}` : undefined,
                      }}
                    >
                      <span className={`${n.kind === "dom" ? "text-[11px] font-light tx1" : "text-[11px] font-extralight tx2"} leading-4`}>
                        {t(n.label, lang)}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <aside className="glass-dark hidden w-[240px] shrink-0 flex-col overflow-auto p-3 sm:flex" dir={rtl ? "rtl" : "ltr"}>
        <div className="text-[9px] tx4">{rtl ? "گره انتخاب‌شده" : "Selected"}</div>
        <div className="mt-1 text-[13px] font-medium tx1" style={{ color: node.accent }}>{info.title}</div>
        <div className="mt-0.5 text-[9.5px] tx3">{info.domain}</div>
        {info.activity && <p className="mt-3 text-[10.5px] leading-5 tx2">{info.activity}</p>}
        <dl className="mt-3 space-y-2 text-[9.5px]">
          {info.source && (
            <div>
              <dt className="tx4">{rtl ? "منبع" : "Source"}</dt>
              <dd className="tx2">{info.source}</dd>
            </div>
          )}
          {info.sql && (
            <div>
              <dt className="tx4">SQL</dt>
              <dd className="font-mono tx2" dir="ltr">{info.sql}</dd>
            </div>
          )}
          {info.output && (
            <div>
              <dt className="tx4">{rtl ? "خروجی" : "Output"}</dt>
              <dd className="tx2">{info.output}</dd>
            </div>
          )}
          {info.to && (
            <div>
              <dt className="tx4">{rtl ? "اتصال به" : "Connects"}</dt>
              <dd className="tx2">{info.to}</dd>
            </div>
          )}
        </dl>
      </aside>
    </div>
  );
}
