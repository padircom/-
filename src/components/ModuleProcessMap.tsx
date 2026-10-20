import { useState } from "react";
import mapImage from "../assets/pmbok-module-map.png";
import { useAuth } from "../context/AuthContext";
import type { Lang } from "../data/framework";

/** نقشهٔ فرایندی ماژول‌ها (تصویر PMBOK) با نقاط کلیک روی هر ماژول.
 *  مختصات به‌صورت درصد نسبت به ابعاد تصویر (۳۸۴۰×۲۶۸۲) نگه‌داری می‌شوند
 *  تا تصویر در هر اندازه‌ای درست کِش بیاید. */
type Hotspot = {
  moduleId: string;
  group: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const HOTSPOTS: Hotspot[] = [
  { moduleId: "d6", group: "pg1", label: "مدیریت حاکمیت و فرآیندهای PMBOK", x: 79.58, y: 20.88, w: 15.83, h: 7.9 },
  { moduleId: "d20", group: "pg1", label: "مدیریت استراتژیک", x: 79.58, y: 30.05, w: 15.83, h: 7.9 },
  { moduleId: "d2", group: "pg2", label: "مدیریت برنامه‌ریزی و اجرای عملیاتی پروژه", x: 60.83, y: 20.88, w: 15.83, h: 7.9 },
  { moduleId: "d12", group: "pg2", label: "مدیریت مهندسی و طراحی", x: 60.83, y: 30.05, w: 15.83, h: 7.9 },
  { moduleId: "d14", group: "pg3", label: "مدیریت پیمان و صورت‌وضعیت", x: 42.08, y: 20.88, w: 15.83, h: 7.9 },
  { moduleId: "d10", group: "pg3", label: "مدیریت منابع انسانی و بهره‌وری نیروی کار", x: 42.08, y: 30.05, w: 15.83, h: 7.9 },
  { moduleId: "d9", group: "pg3", label: "مدیریت ماشین‌آلات و تجهیزات", x: 42.08, y: 39.22, w: 15.83, h: 7.9 },
  { moduleId: "d16", group: "pg3", label: "مدیریت ایمنی، بهداشت و محیط‌زیست", x: 42.08, y: 48.4, w: 15.83, h: 7.9 },
  { moduleId: "d17", group: "pg3", label: "ثبت سریع میدانی HSE", x: 42.08, y: 57.57, w: 15.83, h: 7.9 },
  { moduleId: "d18", group: "pg3", label: "مدیریت موقعیت مکانی پروژه‌ها (GIS)", x: 42.08, y: 66.74, w: 15.83, h: 7.9 },
  { moduleId: "d5", group: "pg4", label: "مدیریت هزینه، تأمین و لجستیک", x: 23.33, y: 20.88, w: 15.83, h: 7.9 },
  { moduleId: "d3", group: "pg4", label: "مدیریت پایش و کنترل عملکرد پروژه", x: 23.33, y: 30.05, w: 15.83, h: 7.9 },
  { moduleId: "d4", group: "pg4", label: "مدیریت ریسک، تغییرات و ادعاها", x: 23.33, y: 39.22, w: 15.83, h: 7.9 },
  { moduleId: "d8", group: "pg4", label: "مدیریت کیفیت و بازرسی", x: 23.33, y: 48.4, w: 15.83, h: 7.9 },
  { moduleId: "d15", group: "pg5", label: "مدیریت راه‌اندازی، تحویل و انعقاد پیمان", x: 4.58, y: 20.88, w: 15.83, h: 7.9 },
  { moduleId: "d1", group: "support", label: "مدیریت اطلاعات و مستندات پروژه", x: 63.18, y: 81.28, w: 18.49, h: 7.9 },
  { moduleId: "d11", group: "support", label: "مدیریت ارتباطات و دانش", x: 43.65, y: 81.28, w: 18.49, h: 7.9 },
  { moduleId: "d7", group: "support", label: "مدیریت سامانه و پیکربندی پایه", x: 24.11, y: 81.28, w: 18.49, h: 7.9 },
  { moduleId: "d19", group: "support", label: "مدیریت تعالی سازمانی (EFQM)", x: 4.58, y: 81.28, w: 18.49, h: 7.9 },
];

const GROUP_TITLE: Record<string, string> = {
  pg1: "آغازین",
  pg2: "برنامه‌ریزی",
  pg3: "اجرا",
  pg4: "پایش و کنترل",
  pg5: "اختتامیه",
  support: "پشتیبان",
};

export default function ModuleProcessMap({
  lang,
  onOpenModule,
}: {
  lang: Lang;
  onOpenModule: (moduleId: string) => void;
}) {
  const rtl = lang === "fa";
  const { can } = useAuth();
  const [zoom, setZoom] = useState(100);
  /* ماژولِ در حال اشاره‌گر — حلقهٔ آبی روی کارت. حالت hover با حالت CSS
   * (که در مرورگرهای بدون پشتیبانی hover غیرفعال است) پیاده می‌شود. */
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[12px] font-medium tx1">
          {rtl ? "نقشهٔ فرایندی ماژول‌ها" : "Module process map"}
        </span>
        <span className="text-[9.5px] font-extralight tx3">
          {rtl
            ? "روی کارت هر ماژول کلیک کنید تا وارد همان ماژول شوید"
            : "Click any module card to open that module"}
        </span>
        <span className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(80, z - 20))}
            disabled={zoom <= 80}
            className="glass-row grid h-6 w-6 place-items-center rounded-lg text-[12px] tx1 transition disabled:opacity-30"
            aria-label={rtl ? "کوچک‌نمایی" : "Zoom out"}
          >
            −
          </button>
          <span className="min-w-[38px] text-center text-[9.5px] tabular-nums tx3">{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(240, z + 20))}
            disabled={zoom >= 240}
            className="glass-row grid h-6 w-6 place-items-center rounded-lg text-[12px] tx1 transition disabled:opacity-30"
            aria-label={rtl ? "بزرگ‌نمایی" : "Zoom in"}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="glass-row rounded-lg px-2 py-1 text-[9.5px] font-light tx2 transition hover:tx1"
          >
            {rtl ? "اندازهٔ مناسب" : "Fit"}
          </button>
        </span>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-2xl bg-white/95 p-1">
        <div className="relative mx-auto" style={{ width: `${zoom}%`, minWidth: zoom > 100 ? `${zoom}%` : undefined }}>
          <img
            src={mapImage}
            alt={rtl ? "نقشهٔ فرایندی ماژول‌ها" : "Module process map"}
            draggable={false}
            className="block w-full select-none"
          />
          {HOTSPOTS.map((h) => {
            /* ماژول «مدیریت سامانه و پیکربندی پایه» فقط مدیر سامانه می‌بیند. */
            const locked = h.moduleId === "d7" && !can("system.manage");
            return (
              <button
                key={h.moduleId}
                type="button"
                disabled={locked}
                onClick={() => { if (!locked) onOpenModule(h.moduleId); }}
                onMouseEnter={() => setActive(h.moduleId)}
                onMouseLeave={() => setActive((a) => (a === h.moduleId ? null : a))}
                onFocus={() => setActive(h.moduleId)}
                onBlur={() => setActive((a) => (a === h.moduleId ? null : a))}
                title={locked
                  ? (rtl ? `${h.label} — فقط مدیر سامانه` : `${h.label} — system admin only`)
                  : `${h.label} — ${GROUP_TITLE[h.group] ?? ""}`}
                aria-label={h.label}
                className={`absolute rounded-[14px] transition ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
                style={{
                  left: `${h.x}%`,
                  top: `${h.y}%`,
                  width: `${h.w}%`,
                  height: `${h.h}%`,
                  boxShadow: active === h.moduleId
                    ? "inset 0 0 0 2px rgba(14,165,233,.95), 0 0 18px rgba(14,165,233,.45)"
                    : locked
                      ? "inset 0 0 0 1px rgba(251,113,133,.45)"
                      : undefined,
                }}
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[14px]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
