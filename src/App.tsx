import { lazy, Suspense, useEffect, useState } from "react";
import LeftSidebar from "./components/LeftSidebar";
import RightSidebar, { type ModuleNavTarget } from "./components/RightSidebar";
import PmbokRing from "./components/PmbokRing";
import PortfolioPanel from "./components/PortfolioPanel";
import ProjectScopeBar from "./components/ProjectScopeBar";
import CalendarView from "./components/CalendarView";
import CalcPanel from "./components/CalcPanel";
import MonitoringWorkspace from "./components/MonitoringWorkspace";
import ProcessFlowNet from "./components/ProcessFlowNet";
import AuthStatus from "./components/AuthStatus";
import NotificationOpsPanel from "./components/NotificationOpsPanel";
import { useSystem } from "./context/SystemContext";
import {
  ui,
  t,
  type Bi,
  type Lang,
} from "./data/framework";

const ModuleDetail = lazy(() => import("./components/ModuleDetail"));

type Theme = "dark" | "light";

/* ──────────────────────────────── Icons ──────────────────────────────── */
const SunIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
  </svg>
);
const MoonIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);
const ClockIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const CalIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M4 11h16" />
  </svg>
);

/* ─────────────────────── Weather (open-meteo, no key) ────────────────── */
const weatherMeta = (code: number): [string, Bi] => {
  if (code === 0) return ["☀️", { fa: "آفتابی", en: "Clear" }];
  if (code === 1 || code === 2) return ["⛅", { fa: "متناوب ابر و آفتاب", en: "Partly Cloudy" }];
  if (code === 3) return ["☁️", { fa: "ابری", en: "Cloudy" }];
  if (code === 45 || code === 48) return ["🌫", { fa: "مه", en: "Fog" }];
  if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return ["🌦", { fa: "بارش پراکنده", en: "Showers" }];
  if (code === 66 || code === 67 || code >= 61 && code <= 65) return ["🌧", { fa: "بارانی", en: "Rain" }];
  if (code >= 71 && code <= 77) return ["🌨", { fa: "برفی", en: "Snow" }];
  if (code === 85 || code === 86) return ["🌨", { fa: "بارش برف", en: "Snow Showers" }];
  if (code >= 95) return ["⛈", { fa: "طوفانی", en: "Thunderstorm" }];
  return ["☀️", { fa: "آفتابی", en: "Clear" }];
};

function useWeather() {
  const [w, setW] = useState({ icon: "☀️", temp: 24, label: { fa: "آفتابی", en: "Clear" } as Bi });
  useEffect(() => {
    let alive = true;
    const apply = (lat: number, lon: number) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (!alive) return;
          const cw = d?.current_weather;
          if (cw && typeof cw.temperature === "number") {
            const [icon, label] = weatherMeta(cw.weathercode ?? 0);
            setW({ icon, temp: Math.round(cw.temperature), label });
          }
        })
        .catch(() => {});
    };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => apply(p.coords.latitude, p.coords.longitude),
        () => apply(35.69, 51.39), // fallback: Tehran
        { timeout: 4000, maximumAge: 600000 }
      );
    } else {
      apply(35.69, 51.39);
    }
    return () => {
      alive = false;
    };
  }, []);
  return w;
}

/* ─────────── Real-time environment dock: clock · date · weather ─────────── */
function EnvWidgets({ lang }: { lang: Lang }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const weather = useWeather();
  const locale = lang === "fa" ? "fa-IR" : "en-GB";
  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const date = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const temp = weather.temp.toLocaleString(locale);

  return (
    <div className="flex items-center gap-2">
      {/* online weather */}
      <div className="wchip" title="Live weather — open-meteo">
        <span className="text-[13px] leading-none">{weather.icon}</span>
        <span className="text-[12px] font-normal tx1 tabular-nums">{temp}°C</span>
        <span className="text-[9px] font-extralight tx3">{t(weather.label, lang)}</span>
      </div>
      {/* system date — Shamsi in FA, Gregorian in EN */}
      <div className="wchip" title="System date">
        <CalIcon className="h-3.5 w-3.5 tx3" />
        <span className="text-[10.5px] font-light tx2">{date}</span>
      </div>
      {/* live clock HH:MM:SS */}
      <div className="wchip" title="Live clock">
        <ClockIcon className="h-3.5 w-3.5 tx3" />
        <span className="text-[12px] font-normal tx1 tabular-nums" dir="ltr">{time}</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────── App ──────────────────────────────── */
export default function App() {
  const { projectsByCluster, projectScope, setProjectScope } = useSystem();
  const [lang, setLang] = useState<Lang>("fa");
  const [theme, setTheme] = useState<Theme>("dark");
  const [quickAction, setQuickAction] = useState<string>("home");
  const [node, setNode] = useState<string | null>(null);
  const [cluster, setCluster] = useState<string | null>("c1");
  const [source, setSource] = useState<string | null>("p6");
  const [moduleNav, setModuleNav] = useState<ModuleNavTarget | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (projectScope?.clusterId) setCluster(projectScope.clusterId);
  }, [projectScope?.clusterId]);

  const rtl = lang === "fa";

  const changeScope = (clusterId: string, projectId: string) => {
    setProjectScope({ clusterId, projectId });
    setCluster(clusterId);
    setModuleNav((current) =>
      current && current.moduleId !== "d7"
        ? { ...current, clusterId, projectId }
        : current
    );
  };

  const chooseCluster = (clusterId: string | null) => {
    setCluster(clusterId);
    if (!clusterId) return;
    const currentProjectMatches = projectScope?.clusterId === clusterId
      && projectsByCluster[clusterId]?.some((project) => project.id === projectScope.projectId);
    const projectId = currentProjectMatches
      ? projectScope!.projectId
      : projectsByCluster[clusterId]?.[0]?.id;
    if (projectId) changeScope(clusterId, projectId);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* ═══ Expanded corporate command bar ═══ */}
      <header
        dir="ltr"
        className="glass-dark relative z-20 flex min-h-[76px] shrink-0 items-center gap-3 border-x-0 border-t-0 px-4 py-3"
      >
        {/* ── fixed left corner: live dock + switchers (never moves) ── */}
        <div className="order-first flex shrink-0 items-center gap-2">
          <div className="hidden md:block">
            <EnvWidgets lang={lang} />
          </div>

          <span className="hline h-6 w-px" />

          {/* FA / EN language switcher */}
          <div className="toggle-shell flex items-center gap-1 rounded-xl p-[3px]" dir="ltr">
            {(["fa", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-lg px-3 py-1 text-[10.5px] font-light transition ${
                  lang === l ? "toggle-on tx1" : "tx3"
                }`}
              >
                {l === "fa" ? "فارسی" : "EN"}
              </button>
            ))}
          </div>

          {/* Sun / Moon theme switcher */}
          <div className="toggle-shell flex items-center gap-1 rounded-xl p-[3px]" dir="ltr" title="Theme">
            <button
              onClick={() => setTheme("light")}
              aria-label="Light theme"
              className={`grid h-7 w-8 place-items-center rounded-lg transition ${theme === "light" ? "toggle-on" : ""}`}
            >
              <SunIcon className={`h-4 w-4 transition ${theme === "light" ? "text-amber-500" : "tx4"}`} />
            </button>
            <button
              onClick={() => setTheme("dark")}
              aria-label="Dark theme"
              className={`grid h-7 w-8 place-items-center rounded-lg transition ${theme === "dark" ? "toggle-on" : ""}`}
            >
              <MoonIcon className={`h-4 w-4 transition ${theme === "dark" ? "text-sky-300" : "tx4"}`} />
            </button>
          </div>

          <AuthStatus lang={lang} />
        </div>

        <div className="mx-auto" />

        {/* ── fixed right corner: brand + maker credits ── */}
        <div className="order-last ms-auto flex min-w-0 items-center gap-3" dir={rtl ? "rtl" : "ltr"}>
          <span className="chip-bg b-line grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[20px] ring-1">◈</span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-light tx1">{t(ui.hubTitle, lang)}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-normal">
              <span className="font-medium tx2">
                {rtl
                  ? "سازنده: محمدرضا هاشمی‌پور"
                  : "Developed by: Mohammadreza Hashemipour"}
              </span>
              <span className="tx4">|</span>
              <span className="font-normal tx3">
                {rtl
                  ? "کارشناس ارشد مدیریت ساخت"
                  : "M.Sc. in Construction Management"}
              </span>
              <span className="tx4">|</span>
              <span className="font-extralight tx4">Beta 1.1.0</span>
            </p>
          </div>
        </div>

      </header>

      {/* ═══ Three co-existing pillars (physical order locked, LTR flex) ═══ */}
      <main dir="ltr" className="flex min-h-0 flex-1 gap-3 p-3">
        <LeftSidebar
          lang={lang}
          activeSource={source}
          onPick={(id) => setSource(id === source ? null : id)}
        />

        <section className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <ProjectScopeBar lang={lang} onScopeChange={changeScope} />
          {moduleNav ? (
            <Suspense fallback={<div className="glass flex flex-1 items-center justify-center rounded-2xl text-[11px] tx3">…</div>}>
              <ModuleDetail
                lang={lang}
                target={moduleNav}
                onBack={() => setModuleNav(null)}
                onOpenFlowNet={() => {
                  setModuleNav(null);
                  setQuickAction("flownet");
                }}
              />
            </Suspense>
          ) : quickAction === "calendar" ? (
            <CalendarView lang={lang} />
          ) : quickAction === "calc" ? (
            <CalcPanel lang={lang} />
          ) : quickAction === "reports" ? (
            <MonitoringWorkspace lang={lang} />
          ) : quickAction === "alerts" ? (
            <NotificationOpsPanel lang={lang} />
          ) : quickAction === "portfolio" ? (
            <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
              <PortfolioPanel
                lang={lang}
                selected={cluster}
                onSelect={chooseCluster}
                activeProjectId={projectScope?.projectId ?? null}
                onOpenProject={changeScope}
              />
            </div>
          ) : quickAction === "flownet" ? (
            <ProcessFlowNet lang={lang} onBack={() => setQuickAction("home")} />
          ) : (
            <div className="glass relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl px-4 py-2">
              <PmbokRing lang={lang} selected={node} onSelect={(id) => setNode(id === node ? null : id)} />
            </div>
          )}
        </section>

        <RightSidebar
          lang={lang}
          quickAction={quickAction}
          onQuickAction={(id) => {
            setQuickAction(id);
            setModuleNav(null);
          }}
          onNavigate={(target) => {
            if (target.moduleId !== "d7" && target.clusterId && target.projectId) {
              changeScope(target.clusterId, target.projectId);
}
            setModuleNav(target);
            setQuickAction("home");
          }}
        />
      </main>
    </div>
  );
}

