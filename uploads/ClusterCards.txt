import { clusters, stateLegend, ui, t, type Lang } from "../data/framework";

type Props = {
  lang: Lang;
  selected: string | null;
  onSelect: (id: string) => void;
};

function ProgressRing({ value, color }: { value: number; color: string }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0 -rotate-90">
      <circle className="s-track" cx="22" cy="22" r={r} fill="none" strokeWidth="2" />
      <circle
        cx="22" cy="22" r={r}
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
      <text
        className="f-ink rotate-90"
        style={{ transformOrigin: "22px 22px" }}
        x="22" y="22"
        textAnchor="middle" dominantBaseline="central"
        fontSize="10"
      >
        {value}
      </text>
    </svg>
  );
}

export default function ClusterCards({ lang, selected, onSelect }: Props) {
  const rtl = lang === "fa";
  return (
    <section dir={rtl ? "rtl" : "ltr"} className="w-full">
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-[11px] font-normal tracking-wide tx2">{t(ui.clustersTitle, lang)}</h3>
        <span className="hair h-px flex-1" />
        <div className="flex items-center gap-3">
          {stateLegend.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-[9px] font-extralight tx3">
              <i className="h-[6px] w-[6px] rounded-full" style={{ background: s.dot }} />
              {t(s.label, lang)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        {clusters.map((c) => {
          const on = selected === c.id;
          const total = c.active + c.tender + c.stopped + c.completed;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`glass-dark rounded-2xl px-3 py-2.5 text-start transition-all duration-200 hover:-translate-y-0.5 ${
                on ? "ring-1" : ""
              }`}
              style={on ? { borderColor: c.color, boxShadow: `0 0 22px -10px ${c.color}`, ["--tw-ring-color" as string]: `${c.color}88` } : undefined}
            >
              <div className="flex items-center gap-2">
                <ProgressRing value={c.progress} color={c.color} />
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-light leading-4 tx1">{t(c.title, lang)}</div>
                  <div className="mt-0.5 text-[9px] font-extralight tx3">
                    {total} {t(ui.projects, lang)}
                  </div>
                </div>
                <span className="ms-auto text-[13px] opacity-70">{c.icon}</span>
              </div>

              <div className="b-line-soft mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t pt-2">
                {stateLegend.map((s) => (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <i className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: s.dot }} />
                    <span className="truncate text-[8.5px] font-extralight tx3">{t(s.label, lang)}</span>
                    <span className="ms-auto text-[10px] font-light tx1">{c[s.key]}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* System footnote anchor */}
      <div className="mt-2.5 flex items-center gap-2 px-1">
        <span className="pulse-dot h-[7px] w-[7px] rounded-full bg-emerald-400" />
        <span className="text-[9.5px] font-extralight tx3" dir="ltr">
          {t(ui.footnote, lang)}
        </span>
        <span className="b-line-soft h-px flex-1" style={{ background: "var(--line-soft)" }} />
        <span className="ok-dim-t text-[9px] font-extralight">{t(ui.live, lang)}</span>
      </div>
    </section>
  );
}
