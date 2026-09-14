/**
 * موتور چیدمان قابل جابه‌جایی پنل‌ها.
 *
 * کاربر خواست بتواند کارت‌ها را «طولی یا عرضی» جابه‌جا کند و در پایان
 * صفحه را قفل نماید. این فایل منطق آن را نگه می‌دارد — بدون هیچ وابستگی
 * به React — تا بتوان بدون مرورگر آزمونش کرد.
 *
 * سه تصمیم بنیادی:
 *
 * ۱. **قفل پیش‌فرض روشن است.** کاربری که چیدمان را تنظیم کرده، دفعهٔ
 *    بعد نباید با یک کشیدن تصادفی همه‌چیز را به هم بریزد. ویرایش باید
 *    عمدی باشد.
 *
 * ۲. **ترتیب و پهنا جدا از هم ذخیره می‌شوند.** جابه‌جایی طولی یعنی
 *    تغییر ترتیب؛ عرضی یعنی تغییر پهنا. قاطی کردنشان در یک ساختار،
 *    بازگرداندن یکی بدون دیگری را ناممکن می‌کند.
 *
 * ۳. **پنل ناشناخته دور ریخته نمی‌شود.** اگر نسخهٔ تازهٔ برنامه پنلی
 *    اضافه کند که در چیدمان ذخیره‌شده نیست، آن پنل به انتها می‌رود نه
 *    اینکه ناپدید شود. کاربر نباید برای دیدن قابلیت تازه، چیدمانش را
 *    دور بریزد.
 */

export const LAYOUT_VERSION = "lay-v1";

/* ══════════════════════════ نوع‌ها ══════════════════════════ */

/** پهنای پنل به‌صورت کسری از عرض ردیف. */
export type PanelWidth = "full" | "half" | "third" | "two-thirds";

export type PanelState = {
  id: string;
  /** جای پنل در ترتیب عمودی. */
  order: number;
  width: PanelWidth;
  /**
   * پهنای آزاد بر حسب درصد، وقتی کاربر با کشیدن لبه تنظیمش کرده.
   *
   * حالت‌های نام‌دار (`third`/`half`/…) برای شروع کافی بودند ولی کاربر
   * خواست ابعاد را «با دست» تغییر دهد. اگر این میدان پر باشد بر
   * `width` مقدم است؛ `width` به‌عنوان نزدیک‌ترین حالت نام‌دار نگه
   * داشته می‌شود تا اگر کاربر بعداً درصد را پاک کرد، چیدمان به یک
   * حالت معقول برگردد.
   */
  pct?: number;
  hidden?: boolean;
};

export type LayoutState = {
  version: string;
  locked: boolean;
  panels: PanelState[];
};

/** تعریف ثابت یک پنل — از کد می‌آید، نه از ذخیره‌سازی. */
export type PanelDef = {
  id: string;
  titleFa: string;
  titleEn: string;
  /** پنل‌هایی که پنهان‌شدنی نیستند چون بدون آن‌ها صفحه بی‌معنا می‌شود. */
  required?: boolean;
  defaultWidth?: PanelWidth;
};

export const WIDTH_ORDER: PanelWidth[] = ["third", "half", "two-thirds", "full"];

/** درصد عرض هر حالت — برای محاسبه و آزمون. */
export const WIDTH_PCT: Record<PanelWidth, number> = {
  third: 33.333,
  half: 50,
  "two-thirds": 66.667,
  full: 100,
};

/** کمینه و بیشینهٔ پهنای دستی. */
export const MIN_PCT = 20;
export const MAX_PCT = 100;

/**
 * مهار درصد پهنا.
 *
 * زیر ۲۰ درصد کارت آن‌قدر باریک می‌شود که محتوایش خوانا نیست و کاربر
 * راهی برای گرفتن لبه‌اش پیدا نمی‌کند — یعنی کارت عملاً گم می‌شود.
 */
export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return MAX_PCT;
  return Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(v * 10) / 10));
}

/** نزدیک‌ترین حالت نام‌دار به یک درصد دلخواه. */
export function nearestWidth(pct: number): PanelWidth {
  let best: PanelWidth = "full";
  let gap = Infinity;
  for (const w of WIDTH_ORDER) {
    const d = Math.abs(WIDTH_PCT[w] - pct);
    if (d < gap) {
      gap = d;
      best = w;
    }
  }
  return best;
}

/** پهنای مؤثر: درصد دستی در اولویت، وگرنه حالت نام‌دار. */
export function effectivePct(p: Pick<PanelState, "width" | "pct">): number {
  return typeof p.pct === "number" ? clampPct(p.pct) : WIDTH_PCT[p.width];
}

export function widthClass(w: PanelWidth): string {
  switch (w) {
    case "third":
      return "basis-[calc(33.333%-0.5rem)]";
    case "half":
      return "basis-[calc(50%-0.5rem)]";
    case "two-thirds":
      return "basis-[calc(66.667%-0.5rem)]";
    default:
      return "basis-full";
  }
}

/* ══════════════════════════ ساخت و بازیابی ══════════════════════════ */

export function defaultLayout(defs: PanelDef[]): LayoutState {
  return {
    version: LAYOUT_VERSION,
    /* قفل روشن: ویرایش چیدمان باید عمدی باشد. */
    locked: true,
    panels: defs.map((d, i) => ({ id: d.id, order: i, width: d.defaultWidth ?? "full", hidden: false })),
  };
}

const isWidth = (v: unknown): v is PanelWidth =>
  typeof v === "string" && (WIDTH_ORDER as string[]).includes(v);

/**
 * آشتی دادن چیدمان ذخیره‌شده با تعریف فعلی پنل‌ها.
 *
 * دو خطر واقعی اینجا بسته می‌شود:
 *  ـ پنلی که در کد هست ولی در ذخیره نیست → به انتها افزوده می‌شود
 *  ـ پنلی که در ذخیره هست ولی از کد حذف شده → کنار گذاشته می‌شود
 *
 * بدون مورد اول، هر قابلیت تازه برای کاربرانی که چیدمان ذخیره کرده‌اند
 * نامرئی می‌ماند و کسی نمی‌فهمد چرا.
 */
export function reconcile(saved: unknown, defs: PanelDef[]): LayoutState {
  const base = defaultLayout(defs);
  if (!saved || typeof saved !== "object") return base;

  const s = saved as Partial<LayoutState>;
  const savedPanels = Array.isArray(s.panels) ? s.panels : [];
  const byId = new Map<string, Partial<PanelState>>();
  for (const p of savedPanels) {
    if (p && typeof p.id === "string") byId.set(p.id, p);
  }

  const known = defs.map((d) => {
    const hit = byId.get(d.id);
    return {
      id: d.id,
      order: typeof hit?.order === "number" && Number.isFinite(hit.order) ? hit.order : Number.MAX_SAFE_INTEGER,
      width: isWidth(hit?.width) ? hit.width : (d.defaultWidth ?? "full"),
      pct: typeof hit?.pct === "number" && Number.isFinite(hit.pct) ? clampPct(hit.pct) : undefined,
      /* پنل اجباری هرگز پنهان نمی‌ماند، حتی اگر ذخیره چنین بگوید. */
      hidden: d.required ? false : Boolean(hit?.hidden),
    };
  });

  /* پنل‌های تازه (order بی‌نهایت) به انتها می‌روند، با حفظ ترتیب کد. */
  known.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return defs.findIndex((d) => d.id === a.id) - defs.findIndex((d) => d.id === b.id);
  });

  return {
    version: LAYOUT_VERSION,
    locked: typeof s.locked === "boolean" ? s.locked : true,
    panels: known.map((p, i) => ({ ...p, order: i })),
  };
}

/* ══════════════════════════ جابه‌جایی طولی ══════════════════════════ */

/** مرتب‌سازی پنل‌ها بر پایهٔ ترتیب. */
export function ordered(layout: LayoutState): PanelState[] {
  return [...layout.panels].sort((a, b) => a.order - b.order);
}

/**
 * جابه‌جایی یک پنل به بالا یا پایین.
 *
 * پنل پنهان در شمارش نمی‌آید: اگر بیاید، کاربر دکمه را می‌زند و هیچ
 * تغییری نمی‌بیند چون پنل با یک پنلِ نامرئی جا عوض کرده است.
 */
export function movePanel(layout: LayoutState, id: string, dir: -1 | 1): LayoutState {
  if (layout.locked) return layout;

  const list = ordered(layout);
  const visible = list.filter((p) => !p.hidden);
  const at = visible.findIndex((p) => p.id === id);
  if (at === -1) return layout;

  const to = at + dir;
  if (to < 0 || to >= visible.length) return layout;

  const a = visible[at];
  const b = visible[to];
  const swapped = list.map((p) => {
    if (p.id === a.id) return { ...p, order: b.order };
    if (p.id === b.id) return { ...p, order: a.order };
    return p;
  });

  return { ...layout, panels: swapped.sort((x, y) => x.order - y.order).map((p, i) => ({ ...p, order: i })) };
}

/** انتقال با کشیدن و رها کردن — از یک جای دیداری به جای دیگر. */
export function reorderTo(layout: LayoutState, fromId: string, toId: string): LayoutState {
  if (layout.locked || fromId === toId) return layout;

  const list = ordered(layout);
  const fromAt = list.findIndex((p) => p.id === fromId);
  const toAt = list.findIndex((p) => p.id === toId);
  if (fromAt === -1 || toAt === -1) return layout;

  const next = [...list];
  const [moved] = next.splice(fromAt, 1);
  next.splice(toAt, 0, moved);

  return { ...layout, panels: next.map((p, i) => ({ ...p, order: i })) };
}

/* ══════════════════════════ جابه‌جایی عرضی ══════════════════════════ */

/**
 * چرخش پهنا در حلقه: یک‌سوم ← نصف ← دوسوم ← تمام ← یک‌سوم.
 *
 * حلقه‌ای است نه خطی، چون کاربر نباید برای برگشتن از «تمام» به
 * «یک‌سوم» دکمهٔ دیگری پیدا کند.
 */
export function cycleWidth(layout: LayoutState, id: string, dir: 1 | -1 = 1): LayoutState {
  if (layout.locked) return layout;

  return {
    ...layout,
    panels: layout.panels.map((p) => {
      if (p.id !== id) return p;
      const at = WIDTH_ORDER.indexOf(p.width);
      const next = (at + dir + WIDTH_ORDER.length) % WIDTH_ORDER.length;
      return { ...p, width: WIDTH_ORDER[next] };
    }),
  };
}

export function setWidth(layout: LayoutState, id: string, width: PanelWidth): LayoutState {
  if (layout.locked) return layout;
  /* انتخاب حالت نام‌دار، درصد دستی را کنار می‌گذارد؛ وگرنه کاربر روی
   * «نصف» می‌زند و هیچ تغییری نمی‌بیند چون درصد قبلی هنوز حاکم است. */
  return { ...layout, panels: layout.panels.map((p) => (p.id === id ? { ...p, width, pct: undefined } : p)) };
}

/** تنظیم پهنا با کشیدن لبه. */
export function setPct(layout: LayoutState, id: string, pct: number): LayoutState {
  if (layout.locked) return layout;
  const v = clampPct(pct);
  return {
    ...layout,
    panels: layout.panels.map((p) => (p.id === id ? { ...p, pct: v, width: nearestWidth(v) } : p)),
  };
}

/** بازگشت به حالت نام‌دار و رها کردن پهنای دستی. */
export function clearPct(layout: LayoutState, id: string): LayoutState {
  if (layout.locked) return layout;
  return { ...layout, panels: layout.panels.map((p) => (p.id === id ? { ...p, pct: undefined } : p)) };
}

/* ══════════════════════════ پنهان‌سازی و قفل ══════════════════════════ */

/**
 * پنهان یا آشکار کردن پنل.
 *
 * پنل اجباری پنهان نمی‌شود. بدون این قید، کاربر می‌تواند ناحیهٔ استخراج
 * را ببندد و بعد صفحه‌ای ببیند که هیچ کاری نمی‌کند و دلیلش پیدا نیست.
 */
export function toggleHidden(layout: LayoutState, id: string, defs: PanelDef[]): LayoutState {
  if (layout.locked) return layout;
  const def = defs.find((d) => d.id === id);
  if (def?.required) return layout;

  return { ...layout, panels: layout.panels.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p)) };
}

export function setLocked(layout: LayoutState, locked: boolean): LayoutState {
  return { ...layout, locked };
}

export function toggleLock(layout: LayoutState): LayoutState {
  return { ...layout, locked: !layout.locked };
}

/* ══════════════════════════ ذخیره‌سازی ══════════════════════════ */

export const layoutStorageKey = (scope: string) => `arena.layout.${scope}`;

/**
 * خواندن از حافظهٔ مرورگر.
 *
 * هر خطایی به چیدمان پیش‌فرض می‌افتد: JSON خراب، حافظهٔ غیرقابل‌دسترس
 * در حالت ناشناس، یا نسخهٔ ناسازگار. صفحه‌ای که به‌خاطر یک رشتهٔ خراب
 * در حافظهٔ محلی بالا نیاید، بدترین نوع شکست است.
 */
export function loadLayout(scope: string, defs: PanelDef[], storage?: Storage): LayoutState {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    if (!store) return defaultLayout(defs);
    const raw = store.getItem(layoutStorageKey(scope));
    if (!raw) return defaultLayout(defs);
    return reconcile(JSON.parse(raw), defs);
  } catch {
    return defaultLayout(defs);
  }
}

export function saveLayout(scope: string, layout: LayoutState, storage?: Storage): boolean {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    if (!store) return false;
    store.setItem(layoutStorageKey(scope), JSON.stringify(layout));
    return true;
  } catch {
    /* حافظهٔ پر یا ممنوع نباید کار کاربر را متوقف کند؛ چیدمان در همان
     * نشست کار می‌کند، فقط ماندگار نمی‌شود. */
    return false;
  }
}

export function clearLayout(scope: string, storage?: Storage): void {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    store?.removeItem(layoutStorageKey(scope));
  } catch {
    /* پاک نشدن حافظه خطای کاربر نیست. */
  }
}

/* ══════════════════════════ خلاصه ══════════════════════════ */

export type LayoutSummary = {
  visible: number;
  hidden: number;
  rows: number;
};

/**
 * شمارش ردیف‌های دیداری.
 *
 * پنل‌ها تا پر شدن عرض کنار هم می‌نشینند؛ این تابع می‌گوید نتیجه چند
 * ردیف می‌شود تا کاربر پیش از قفل کردن بداند چه شکلی درآمده.
 */
export function summarize(layout: LayoutState): LayoutSummary {
  const vis = ordered(layout).filter((p) => !p.hidden);
  let rows = 0;
  let acc = 0;
  for (const p of vis) {
    const w = effectivePct(p);
    if (acc > 0 && acc + w > 100.5) {
      rows += 1;
      acc = w;
    } else {
      acc += w;
    }
  }
  if (acc > 0) rows += 1;

  return { visible: vis.length, hidden: layout.panels.length - vis.length, rows };
}
