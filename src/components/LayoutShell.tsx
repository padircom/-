/**
 * پوستهٔ چیدمان قابل جابه‌جایی.
 *
 * کاربر خواست بتواند کارت‌ها را طولی یا عرضی جابه‌جا کند و در پایان
 * صفحه را قفل نماید. منطق در `services/panelLayout.ts` است و اینجا
 * فقط رابط کاربری آن نوشته می‌شود.
 *
 * تصمیم‌های رابط:
 *
 * ۱. **در حالت قفل، هیچ دستگیره‌ای دیده نمی‌شود.** صفحه باید دقیقاً
 *    همان شکلی باشد که پیش از افزودن این قابلیت بود. کنترل‌هایی که
 *    همیشه دیده شوند، صفحهٔ کاری را به یک ابزار تنظیم تبدیل می‌کنند.
 *
 * ۲. **کشیدن و رها کردن به‌علاوهٔ دکمه.** کشیدن سریع است ولی روی
 *    صفحهٔ لمسی و با صفحه‌کلید کار نمی‌کند؛ دکمه‌های بالا و پایین همان
 *    کار را برای همه ممکن می‌کنند.
 *
 * ۳. **ذخیره خودکار است.** کاربری که چیدمان را مرتب کرده و یادش رفته
 *    دکمهٔ ذخیره را بزند، دفعهٔ بعد کارش را از دست می‌دهد.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  loadLayout,
  saveLayout,
  clearLayout,
  defaultLayout,
  ordered,
  reorderTo,
  setPct,
  clearPct,
  effectivePct,
  toggleHidden,
  toggleLock,
  summarize,
  type LayoutState,
  type PanelDef,
} from "../services/panelLayout";

export type PanelRender = PanelDef & { node: ReactNode };

type Props = {
  scope: string;
  panels: PanelRender[];
  rtl: boolean;
  /** برچسب اختیاری کنار نوار ابزار چیدمان. */
  titleFa?: string;
  titleEn?: string;
  /**
   * وقتی دکمهٔ قفل جای دیگری (نوار ابزار بالا) نشسته باشد.
   *
   * پوسته نوار خودش را پنهان می‌کند و وضعیت را به والد گزارش می‌دهد.
   * دو دکمهٔ قفل در دو جا یعنی کاربر نمی‌داند کدام حاکم است.
   */
  externalLock?: boolean;
  onLockChange?: (locked: boolean) => void;
};

export default function LayoutShell({ scope, panels, rtl, titleFa, titleEn, externalLock, onLockChange }: Props) {
  const defs = useMemo<PanelDef[]>(
    () => panels.map(({ id, titleFa: tf, titleEn: te, required, defaultWidth }) => ({ id, titleFa: tf, titleEn: te, required, defaultWidth })),
    [panels],
  );

  const [layout, setLayout] = useState<LayoutState>(() => defaultLayout(defs));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [resizing, setResizing] = useState<string | null>(null);
  const hydrated = useRef(false);
  const rowRef = useRef<HTMLDivElement | null>(null);

  /* خواندن از حافظه پس از نخستین رندر انجام می‌شود تا خروجی سرور و
   * مرورگر یکی بماند و React اخطار ناهمخوانی ندهد. */
  useEffect(() => {
    setLayout(loadLayout(scope, defs));
    hydrated.current = true;
  }, [scope, defs]);

  useEffect(() => {
    if (!hydrated.current) return;
    setSaveFailed(!saveLayout(scope, layout));
  }, [scope, layout]);

  /* گزارش وضعیت قفل به والد، تا دکمهٔ بیرونی برچسب درست را نشان دهد. */
  useEffect(() => {
    onLockChange?.(layout.locked);
  }, [layout.locked, onLockChange]);

  /* فرمان قفل از بیرون. */
  useEffect(() => {
    if (typeof externalLock !== "boolean") return;
    setLayout((l) => (l.locked === externalLock ? l : { ...l, locked: externalLock }));
  }, [externalLock]);

  const byId = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels]);
  const list = ordered(layout);
  const visible = list.filter((p) => !p.hidden);
  const stats = summarize(layout);
  const editing = !layout.locked;

  const onDrop = useCallback(
    (toId: string) => {
      if (!dragId) return;
      setLayout((l) => reorderTo(l, dragId, toId));
      setDragId(null);
      setOverId(null);
    },
    [dragId],
  );

  /**
   * تغییر ابعاد با کشیدن لبه.
   *
   * از رویدادهای اشاره‌گر استفاده می‌شود نه ماوس، تا روی صفحهٔ لمسی هم
   * کار کند. مبنای محاسبه عرض ردیف است نه پنجره، وگرنه در چیدمان
   * دوستونی درصدها دو برابر واقعیت خوانده می‌شوند.
   */
  const startResize = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (!editing) return;
      e.preventDefault();
      e.stopPropagation();

      const row = rowRef.current;
      if (!row) return;
      const rowBox = row.getBoundingClientRect();
      const card = (e.currentTarget as HTMLElement).closest("section");
      if (!card) return;
      const cardBox = card.getBoundingClientRect();

      setResizing(id);
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture?.(e.pointerId);

      /* در چیدمان راست‌به‌چپ، لبهٔ کشیدنی سمت چپ کارت است، پس جهت
       * رشد عرض وارونه می‌شود. */
      const anchor = rtl ? cardBox.right : cardBox.left;

      const onMove = (ev: PointerEvent) => {
        const raw = rtl ? anchor - ev.clientX : ev.clientX - anchor;
        const pct = (raw / Math.max(1, rowBox.width)) * 100;
        setLayout((l) => setPct(l, id, pct));
      };
      const onUp = () => {
        setResizing(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [editing, rtl],
  );

  const widthLabel = (w: string) =>
    w === "third" ? "⅓" : w === "half" ? "½" : w === "two-thirds" ? "⅔" : "۱";

  return (
    <div className="space-y-2">
      {/* ── نوار چیدمان ──
        * وقتی دکمهٔ قفل بیرون است، این نوار فقط در حالت ویرایش و برای
        * راهنما دیده می‌شود؛ در حالت قفل هیچ اثری از آن نیست. */}
      <div
        className={`glass-dark flex-wrap items-center gap-2 rounded-2xl px-2.5 py-1.5 text-[9px] ${
          typeof externalLock === "boolean" && !editing ? "hidden" : "flex"
        }`}
      >
        {typeof externalLock !== "boolean" && (
          <button
            onClick={() => setLayout(toggleLock)}
            className={`rounded-lg px-2.5 py-1 transition ${editing ? "toggle-on tx1" : "border b-line-soft tx3"}`}
            title={rtl ? "قفل یا باز کردن چیدمان" : "Lock or unlock the layout"}
          >
            {editing ? (rtl ? "🔓 چیدمان باز — برای قفل بزنید" : "🔓 Unlocked — click to lock")
                     : (rtl ? "🔒 چیدمان قفل — برای ویرایش بزنید" : "🔒 Locked — click to edit")}
          </button>
        )}

        {(titleFa || titleEn) && <span className="tx4">{rtl ? titleFa : titleEn}</span>}

        {editing && (
          <>
            <span className="tx4">
              {rtl
                ? `${stats.visible} کارت · ${stats.rows} ردیف${stats.hidden ? ` · ${stats.hidden} پنهان` : ""}`
                : `${stats.visible} cards · ${stats.rows} rows${stats.hidden ? ` · ${stats.hidden} hidden` : ""}`}
            </span>
            <button
              onClick={() => { clearLayout(scope); setLayout(defaultLayout(defs)); }}
              className="rounded-lg border b-line-soft px-2 py-1 tx3 transition hover:tx1"
            >
              {rtl ? "بازگشت به پیش‌فرض" : "Reset"}
            </button>
            <span className="ms-auto tx4">
              {rtl ? "بکشید و رها کنید، یا از دکمه‌های ↑ ↓ و ⇔ استفاده کنید" : "Drag, or use the ↑ ↓ and ⇔ buttons"}
            </span>
          </>
        )}

        {saveFailed && (
          <span className="ms-auto text-amber-300">
            {rtl ? "⚠ چیدمان ذخیره نشد — در همین نشست کار می‌کند" : "⚠ Layout not persisted"}
          </span>
        )}
      </div>

      {/* ── پنل‌های پنهان ── */}
      {editing && stats.hidden > 0 && (
        <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl px-2.5 py-1.5 text-[9px]">
          <span className="tx3">{rtl ? "پنهان:" : "Hidden:"}</span>
          {list.filter((p) => p.hidden).map((p) => (
            <button
              key={p.id}
              onClick={() => setLayout((l) => toggleHidden(l, p.id, defs))}
              className="rounded-lg border b-line-soft px-2 py-1 tx3 transition hover:tx1"
            >
              + {rtl ? byId.get(p.id)?.titleFa : byId.get(p.id)?.titleEn}
            </button>
          ))}
        </div>
      )}

      {/* ── کارت‌ها ── */}
      <div ref={rowRef} className="flex flex-wrap gap-2">
        {visible.map((p) => {
          const def = byId.get(p.id);
          if (!def) return null;
          const isOver = overId === p.id && dragId !== p.id;
          const pct = effectivePct(p);

          return (
            <section
              key={p.id}
              className={`relative min-w-[200px] ${resizing === p.id ? "" : "transition-[flex-basis]"}`}
              style={{
                flexBasis: `calc(${pct}% - 0.5rem)`,
                flexGrow: pct >= 99.5 ? 1 : 0,
                /* در حالت ویرایش خودِ کارت گرفتنی است. */
                cursor: editing ? (dragId === p.id ? "grabbing" : "grab") : undefined,
                ...(editing ? { outline: "1px dashed var(--line)", outlineOffset: 2, borderRadius: 16 } : {}),
                ...(isOver ? { outline: "1px dashed var(--accent)", outlineOffset: 2, borderRadius: 16 } : {}),
              }}
              draggable={editing}
              onDragStart={() => editing && setDragId(p.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDragOver={(e) => { if (editing && dragId) { e.preventDefault(); setOverId(p.id); } }}
              onDrop={(e) => { if (editing) { e.preventDefault(); onDrop(p.id); } }}
            >
              {/* هیچ نوار عنوانی بالای کارت نیست.
                *
                * کاربر گفت کادر اضافه نمی‌خواهد: جابه‌جایی و تغییر ابعاد
                * باید روی خودِ کارت انجام شود. پس در حالت ویرایش، تمام
                * سطح کارت دستگیرهٔ کشیدن است و تنها یک نشانگر کوچک
                * شناور در گوشه می‌نشیند — بدون افزودن ارتفاع، چون
                * absolute است و جریان صفحه را جابه‌جا نمی‌کند. */}
              {editing && (
                <div
                  className="pointer-events-none absolute z-10 flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[8px]"
                  style={{
                    top: 4,
                    [rtl ? "right" : "left"]: 4,
                    background: "color-mix(in srgb, var(--bg-c) 88%, transparent)",
                    border: "1px solid var(--line)",
                  } as React.CSSProperties}
                >
                  <span className="tx4">⠿</span>
                  <span className="tx3">{rtl ? def.titleFa : def.titleEn}</span>
                  <span className="tabular-nums tx4" dir="ltr">
                    {typeof p.pct === "number" ? `${Math.round(p.pct)}%` : widthLabel(p.width)}
                  </span>
                  {!def.required && (
                    <button
                      onClick={() => setLayout((l) => toggleHidden(l, p.id, defs))}
                      className="pointer-events-auto tx4 transition hover:text-rose-300"
                      title={rtl ? "پنهان کردن" : "Hide"}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {def.node}

              {/* دستگیرهٔ تغییر ابعاد — لبهٔ کناری کارت.
                * فقط در حالت ویرایش دیده می‌شود تا صفحهٔ کاری دست‌نخورده
                * بماند. */}
              {editing && (
                <div
                  onPointerDown={(e) => startResize(e, p.id)}
                  onDoubleClick={() => setLayout((l) => clearPct(l, p.id))}
                  title={rtl ? "بکشید تا عرض تغییر کند · دوبار کلیک برای بازنشانی" : "Drag to resize · double-click to reset"}
                  className="absolute bottom-0 top-0 flex w-3 items-center justify-center"
                  style={{
                    [rtl ? "left" : "right"]: -6,
                    cursor: "col-resize",
                    touchAction: "none",
                  } as React.CSSProperties}
                >
                  <span
                    className="h-10 w-[3px] rounded-full transition"
                    style={{ background: resizing === p.id ? "var(--accent)" : "var(--line)" }}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
