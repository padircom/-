import { processGroups, ui, t, type Lang } from "../data/framework";

type Props = {
  lang: Lang;
  selected: string | null;
  onSelect: (id: string) => void;
};

/* Geometry — 5 fixed anchors, exactly 72° apart */
const CX = 450;
const CY = 340;
const NODE_R = 190;
const LABEL_R = 252;
const START = -90;
const CLUSTER_R = 340; // radial distance of sub-process leaves

const pos = (i: number, r: number) => {
  const a = ((START + i * 72) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
};

/* Fan sub-processes around each group node, respecting 72° sector */
const clusterPos = (groupIndex: number, subIndex: number, subCount: number, r: number) => {
  const groupAngle = START + groupIndex * 72;
  // total fan span up to 60° so it never crosses into the neighbor sector
  const span = Math.min(60, 12 * Math.max(1, subCount - 1) + 24);
  const step = subCount > 1 ? span / (subCount - 1) : 0;
  const a = ((groupAngle - span / 2 + subIndex * step) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), angle: groupAngle - span / 2 + subIndex * step };
};

export default function PmbokRing({ lang, selected, onSelect }: Props) {
  const active = processGroups.find((p) => p.id === selected) ?? null;

  return (
    <div className="relative w-full">
      <svg viewBox="0 0 900 680" className="h-auto max-h-[62vh] w-full overflow-visible" role="img">
        <defs>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9DB6FF" stopOpacity="0.3" />
            <stop offset="70%" stopColor="#2E3D70" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#2E3D70" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hubFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* ══ BASE LAYER — the ONLY rotating elements (dashed strokes) ══ */}
        <g className="pmbok-base-layer">
          <circle cx={CX} cy={CY} r={300} fill="url(#hubGlow)" />
          <circle
            className="ring-dashed-spin s-ring"
            cx={CX} cy={CY} r={225}
            fill="none" strokeWidth={1.1}
            strokeDasharray="10 12" strokeLinecap="round"
          />
          <circle
            className="ring-dashed-spin-rev s-ring-soft"
            cx={CX} cy={CY} r={262}
            fill="none" strokeWidth={0.9}
            strokeDasharray="3 16" strokeLinecap="round"
          />
          <circle
            className="ring-dashed-spin s-ring-soft"
            cx={CX} cy={CY} r={158}
            fill="none" strokeWidth={0.9}
            strokeDasharray="2 14"
          />
          {/* static reference hairline (no animation) */}
          <circle className="s-hair" cx={CX} cy={CY} r={190} fill="none" strokeWidth={0.8} />
        </g>

        {/* ══ OVERLAY LAYER — 5 fixed nodes, zero inherited rotation ══ */}
        <g className="ring-static-layer">
          {/* hub */}
          <circle className="s-hub" cx={CX} cy={CY} r={124} fill="url(#hubFace)" strokeWidth={1} />
          <foreignObject x={CX - 112} y={CY - 66} width={224} height={132}>
            <div
              dir={lang === "fa" ? "rtl" : "ltr"}
              className="flex h-[132px] w-[224px] flex-col items-center justify-center px-3 text-center"
            >
              <div className="text-[10px] font-extralight tracking-[0.22em] tx3">PMBOK · v1.1.0</div>
              <div className="mt-1.5 text-[15px] font-light leading-6 tx1">{t(ui.hubTitle, lang)}</div>
              <div className="hline mt-1.5 h-px w-14" />
              <div className="mt-1.5 text-[11px] font-extralight tx3">
                {active ? t(active.label, lang) : t(ui.hubSub, lang)}
              </div>
            </div>
          </foreignObject>

          {processGroups.map((pg, i) => {
            const n = pos(i, NODE_R);
            const inner = pos(i, 126);
            const lineEnd = pos(i, LABEL_R - 34);
            const l = pos(i, LABEL_R);
            const isOn = selected === pg.id;
            return (
              <g key={pg.id} className="cursor-pointer" onClick={() => onSelect(pg.id)}>
                {/* fine spoke: hub -> node */}
                <line
                  x1={inner.x} y1={inner.y} x2={n.x} y2={n.y}
                  stroke={isOn ? pg.color : "var(--spoke)"}
                  strokeWidth={isOn ? 1 : 0.7}
                  strokeDasharray="2 6"
                />
                {/* fine connector: node -> text box */}
                <line
                  x1={n.x} y1={n.y} x2={lineEnd.x} y2={lineEnd.y}
                  stroke={isOn ? pg.color : "var(--spoke-2)"}
                  strokeWidth={isOn ? 1.3 : 0.8}
                />
                {/* fixed anchor node */}
                <circle
                  className="f-node"
                  cx={n.x} cy={n.y}
                  r={isOn ? 19 : 15}
                  stroke={pg.color}
                  strokeWidth={isOn ? 2 : 1.1}
                />
                <circle cx={n.x} cy={n.y} r={isOn ? 5.5 : 4} fill={pg.color} />
                <text
                  x={n.x} y={n.y + 30}
                  textAnchor="middle" fontSize="9.5"
                  fill={pg.color} opacity={0.9}
                  style={{ letterSpacing: "0.14em" }}
                >
                  {pg.short}
                </text>

                {/* symmetrical text box */}
                <foreignObject x={l.x - 88} y={l.y - 27} width={176} height={54}>
                  <div
                    dir={lang === "fa" ? "rtl" : "ltr"}
                    className={`flex h-[54px] w-[176px] flex-col items-center justify-center rounded-xl px-2 text-center transition-all duration-200 ${
                      isOn ? "glass" : "glass-row"
                    }`}
                    style={isOn ? { borderColor: pg.color, boxShadow: `0 0 18px -6px ${pg.color}` } : undefined}
                  >
                    <span className="text-[12.5px] font-light leading-4 tx1">{t(pg.label, lang)}</span>
                    <span className="mt-0.5 text-[10px] font-extralight tx3">
                      {t(pg.metric, lang)} · {pg.value}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* ══ Sub-process cluster — only for the selected group ══ */}
          {active && (() => {
            const gi = processGroups.findIndex((p) => p.id === active.id);
            const subs = active.processes;
            const n = pos(gi, NODE_R);
            return (
              <g className="fade-rise pointer-events-auto">
                {subs.map((sp, si) => {
                  const p = clusterPos(gi, si, subs.length, CLUSTER_R);
                  const rad = (p.angle * Math.PI) / 180;
                  // small offset toward the leaf so the label sits next to the dot
                  const tx = CX + (CLUSTER_R + 8) * Math.cos(rad);
                  const ty = CY + (CLUSTER_R + 8) * Math.sin(rad);
                  // anchor text based on which side of the ring it sits on
                  const cosA = Math.cos(rad);
                  const anchor = cosA > 0.2 ? "start" : cosA < -0.2 ? "end" : "middle";
                  const dy = Math.sin(rad) > 0.4 ? 12 : Math.sin(rad) < -0.4 ? -6 : 4;
                  return (
                    <g key={si}>
                      {/* dashed connector from the group node to the leaf — matches ring style */}
                      <line
                        x1={n.x} y1={n.y}
                        x2={p.x} y2={p.y}
                        stroke={active.color}
                        strokeOpacity={0.55}
                        strokeWidth={0.9}
                        strokeDasharray="3 5"
                      />
                      {/* leaf dot */}
                      <circle cx={p.x} cy={p.y} r={4.5} fill={active.color} opacity={0.85} />
                      <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={active.color} strokeOpacity={0.35} strokeWidth={0.7} strokeDasharray="2 3" />
                      {/* label — plain text, no box */}
                      <text
                        x={tx} y={ty + dy}
                        textAnchor={anchor}
                        fontSize="12"
                        className="f-ink"
                        style={{ fontWeight: 300, letterSpacing: "0.01em" }}
                      >
                        {t(sp, lang)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}
        </g>
      </svg>
    </div>
  );
}
