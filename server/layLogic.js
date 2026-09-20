// src/services/panelLayout.ts
var LAYOUT_VERSION = "lay-v1";
var WIDTH_ORDER = ["third", "half", "two-thirds", "full"];
var WIDTH_PCT = {
  third: 33.333,
  half: 50,
  "two-thirds": 66.667,
  full: 100
};
var MIN_PCT = 20;
var MAX_PCT = 100;
function clampPct(v) {
  if (!Number.isFinite(v)) return MAX_PCT;
  return Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(v * 10) / 10));
}
function nearestWidth(pct) {
  let best = "full";
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
function effectivePct(p) {
  return typeof p.pct === "number" ? clampPct(p.pct) : WIDTH_PCT[p.width];
}
function widthClass(w) {
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
function defaultLayout(defs) {
  return {
    version: LAYOUT_VERSION,
    /* قفل روشن: ویرایش چیدمان باید عمدی باشد. */
    locked: true,
    panels: defs.map((d, i) => ({ id: d.id, order: i, width: d.defaultWidth ?? "full", hidden: false }))
  };
}
var isWidth = (v) => typeof v === "string" && WIDTH_ORDER.includes(v);
function reconcile(saved, defs) {
  const base = defaultLayout(defs);
  if (!saved || typeof saved !== "object") return base;
  const s = saved;
  const savedPanels = Array.isArray(s.panels) ? s.panels : [];
  const byId = /* @__PURE__ */ new Map();
  for (const p of savedPanels) {
    if (p && typeof p.id === "string") byId.set(p.id, p);
  }
  const known = defs.map((d) => {
    const hit = byId.get(d.id);
    return {
      id: d.id,
      order: typeof hit?.order === "number" && Number.isFinite(hit.order) ? hit.order : Number.MAX_SAFE_INTEGER,
      width: isWidth(hit?.width) ? hit.width : d.defaultWidth ?? "full",
      pct: typeof hit?.pct === "number" && Number.isFinite(hit.pct) ? clampPct(hit.pct) : void 0,
      /* پنل اجباری هرگز پنهان نمی‌ماند، حتی اگر ذخیره چنین بگوید. */
      hidden: d.required ? false : Boolean(hit?.hidden)
    };
  });
  known.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return defs.findIndex((d) => d.id === a.id) - defs.findIndex((d) => d.id === b.id);
  });
  return {
    version: LAYOUT_VERSION,
    locked: typeof s.locked === "boolean" ? s.locked : true,
    panels: known.map((p, i) => ({ ...p, order: i }))
  };
}
function ordered(layout) {
  return [...layout.panels].sort((a, b) => a.order - b.order);
}
function movePanel(layout, id, dir) {
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
function reorderTo(layout, fromId, toId) {
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
function cycleWidth(layout, id, dir = 1) {
  if (layout.locked) return layout;
  return {
    ...layout,
    panels: layout.panels.map((p) => {
      if (p.id !== id) return p;
      const at = WIDTH_ORDER.indexOf(p.width);
      const next = (at + dir + WIDTH_ORDER.length) % WIDTH_ORDER.length;
      return { ...p, width: WIDTH_ORDER[next] };
    })
  };
}
function setWidth(layout, id, width) {
  if (layout.locked) return layout;
  return { ...layout, panels: layout.panels.map((p) => p.id === id ? { ...p, width, pct: void 0 } : p) };
}
function setPct(layout, id, pct) {
  if (layout.locked) return layout;
  const v = clampPct(pct);
  return {
    ...layout,
    panels: layout.panels.map((p) => p.id === id ? { ...p, pct: v, width: nearestWidth(v) } : p)
  };
}
function clearPct(layout, id) {
  if (layout.locked) return layout;
  return { ...layout, panels: layout.panels.map((p) => p.id === id ? { ...p, pct: void 0 } : p) };
}
function toggleHidden(layout, id, defs) {
  if (layout.locked) return layout;
  const def = defs.find((d) => d.id === id);
  if (def?.required) return layout;
  return { ...layout, panels: layout.panels.map((p) => p.id === id ? { ...p, hidden: !p.hidden } : p) };
}
function setLocked(layout, locked) {
  return { ...layout, locked };
}
function toggleLock(layout) {
  return { ...layout, locked: !layout.locked };
}
var layoutStorageKey = (scope) => `arena.layout.${scope}`;
function loadLayout(scope, defs, storage) {
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
function saveLayout(scope, layout, storage) {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    if (!store) return false;
    store.setItem(layoutStorageKey(scope), JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}
function clearLayout(scope, storage) {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
    store?.removeItem(layoutStorageKey(scope));
  } catch {
  }
}
function summarize(layout) {
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
export {
  LAYOUT_VERSION,
  MAX_PCT,
  MIN_PCT,
  WIDTH_ORDER,
  WIDTH_PCT,
  clampPct,
  clearLayout,
  clearPct,
  cycleWidth,
  defaultLayout,
  effectivePct,
  layoutStorageKey,
  loadLayout,
  movePanel,
  nearestWidth,
  ordered,
  reconcile,
  reorderTo,
  saveLayout,
  setLocked,
  setPct,
  setWidth,
  summarize,
  toggleHidden,
  toggleLock,
  widthClass
};
