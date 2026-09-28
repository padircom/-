/**
 * میز کار ارتباطات و دانش d11 — REST (LIVE-2)
 * ------------------------------------------------------------------
 * پیش از این، مکاتبات، جلسات، ذی‌نفعان و درس‌آموخته‌ها فقط در حافظهٔ
 * مرورگر بودند و با رفرش از بین می‌رفتند؛ هیچ مسیر `ckm` در سرور نبود.
 *
 * اصول (کنترل‌ها سمت سرور؛ پنهان کردن دکمه در کلاینت فقط راحتی است):
 *  - نامه با اعتبارسنجی همان موتور `communication.ts` ثبت می‌شود؛ مهلت
 *    پاسخ (DueAt) را سرور بر پایهٔ روز کاری تقویم پروژه می‌نویسد.
 *  - نامهٔ صادره پیش‌نویس است تا امضا شود؛ امضاکننده ≠ تهیه‌کننده.
 *  - نامهٔ ثبت‌شده حذف نمی‌شود (یکپارچگی دفتر اندیکاتور)؛ اعلان
 *    قراردادی بی‌پاسخ بسته نمی‌شود.
 *  - صورت‌جلسه پس از تصویب قفل است؛ تصویب‌کننده ≠ ثبت‌کننده؛ توزیع
 *    فقط پس از تصویب. مصوبه بدون مالک/موعد پذیرفته نمی‌شود.
 *  - درس‌آموخته بدون منشأ و توصیهٔ اجرایی ثبت نمی‌شود؛ تأییدکننده ≠
 *    ثبت‌کننده؛ استفادهٔ مجدد فقط از درس تأییدشده و هر کاربر یک بار.
 *  - مکاتبات «محرمانه»اند: بدون `ckm.letter.view` در پاسخ workspace
 *    نمی‌آیند (بقیهٔ میز کار با سایر مجوزهای ckm دیده می‌شود).
 *  - دادهٔ نمونه فقط با درخواست صریح و فقط روی پروژهٔ خالی.
 */
import {
  ACTION_STATUSES,
  CHANNELS,
  CKM_WS_VERSION,
  ENGAGEMENT_LEVELS,
  EVENT_CODES,
  FREQUENCIES,
  IMPACTS,
  LESSON_CATEGORIES,
  LETTER_CLASSES,
  MEETING_TYPES,
  ckmSampleFor,
  isoDay,
  letterDueDate,
  toAction,
  toLesson,
  toLetter,
} from "./ckmWsLogic.js";
import { isTimeBarred, lessonValue, validateAction, validateLesson, validateLetter } from "./ckmLogic.js";

const PROJECT_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9\u0600-\u06FF][A-Za-z0-9\u0600-\u06FF._\-/]{0,79}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VIEW_PERMS = ["ckm.letter.view", "ckm.meeting.record", "ckm.lesson.publish", "ckm.stakeholder.edit", "ckm.notify.manage"];

class CkmError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new CkmError(400, code, message, extra);
const conflict = (code, message, extra) => new CkmError(409, code, message, extra);
const forbidden = (code, message, extra) => new CkmError(403, code, message, extra);
const notFound = (message) => new CkmError(404, "E-CKM-NOT-FOUND", message);

/* ─────────── اعتبارسنجی ورودی ─────────── */

function text(v, field, { max = 400, required = false, min = 0 } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-CKM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (s.length > max) throw bad("E-CKM-TOO-LONG", `«${field}» حداکثر ${max} نویسه است`, { field });
  if (s.length < min) throw bad("E-CKM-TOO-SHORT", `«${field}» دست‌کم ${min} نویسه باشد`, { field });
  return s;
}

function int(v, field, { min = -Infinity, max = Infinity, required = false } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw bad("E-CKM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  const x = Number(v);
  if (!Number.isInteger(x) || x < min || x > max) throw bad("E-CKM-INVALID-NUMBER", `«${field}» عدد صحیح در بازهٔ ${min} تا ${max} نیست`, { field });
  return x;
}

function date(v, field, { required = false } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-CKM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) throw bad("E-CKM-INVALID-DATE", `«${field}» تاریخ YYYY-MM-DD نیست`, { field });
  return s;
}

function code(v, field) {
  const s = String(v ?? "").trim();
  if (!s) throw bad("E-CKM-REQUIRED", `«${field}» الزامی است`, { field });
  if (!CODE_RE.test(s)) throw bad("E-CKM-INVALID-CODE", `«${field}» فقط حروف، رقم، نقطه، خط تیره و / (حداکثر ۸۰)`, { field });
  return s;
}

function oneOf(v, field, allowed, { required = true } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-CKM-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (!allowed.includes(s)) throw bad("E-CKM-INVALID-VALUE", `مقدار «${field}» مجاز نیست`, { field, allowed });
  return s;
}

function list(v, field, { max = 40, itemMax = 120, allowed = null } = {}) {
  if (v === undefined || v === null || v === "") return [];
  const raw = Array.isArray(v) ? v : String(v).split(/[،,\n]/);
  const out = Array.from(new Set(raw.map((x) => String(x ?? "").trim()).filter(Boolean)));
  if (out.length > max) throw bad("E-CKM-TOO-MANY", `«${field}» حداکثر ${max} مورد`, { field });
  for (const x of out) {
    if (x.length > itemMax) throw bad("E-CKM-TOO-LONG", `هر مورد «${field}» حداکثر ${itemMax} نویسه`, { field });
    if (allowed && !allowed.includes(x)) throw bad("E-CKM-INVALID-VALUE", `«${x}» در «${field}» مجاز نیست`, { field, allowed });
  }
  return out;
}

/** خطاهای موتور (نه هشدارها) ثبت را متوقف می‌کنند؛ کد موتور به کاربر می‌رسد. */
function assertEngine(issues) {
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length) throw bad(errors[0].code, errors[0].message, { issues: errors });
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/* ─────────── ثبت مسیرها ─────────── */

export function registerCkmWorkspaceRoutes(app, { repo, subjects, evaluate }) {
  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId, version: CKM_WS_VERSION } });

  const fail = (req, res, err) => {
    if (err instanceof CkmError) {
      return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(400).json({ ok: false, error: { code: "E-CKM-VALIDATION", message: err.message, traceId: req.requestId } });
    }
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") {
      return res.status(409).json({ ok: false, error: { code: "E-CKM-DUPLICATE", message: "کد/شماره تکراری است", traceId: req.requestId } });
    }
    console.error(`[${req.requestId}] ckm error:`, err);
    return res.status(500).json({ ok: false, error: { code: "E-CKM-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };

  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const allows = (subject, permission) => Boolean(subject) && evaluate(subject, permission, { projectId: undefined }).allow;

  /** میان‌افزار مجوز؛ آرایه یعنی «یکی از این‌ها کافی است». CKM_RBAC_ENFORCE=0 فقط برای استقرار مرحله‌ای. */
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.CKM_RBAC_ENFORCE ?? "1") !== "0";
    const perms = Array.isArray(permission) ? permission : [permission];
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-CKM-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-CKM-AUTH-REQUIRED", message: "شناسهٔ کاربر برای این اقدام الزامی است", permission: perms[0], traceId: req.requestId } });
    }
    if (enforce && !perms.some((p) => allows(subject, p))) {
      return res.status(403).json({ ok: false, error: { code: "E-CKM-FORBIDDEN", message: "مجوز این اقدام را ندارید", permission: perms.join("|"), traceId: req.requestId } });
    }
    return next();
  };

  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);

  const audit = async (r, req, action, details) => {
    try {
      await r.create("AuditLog", {
        At: new Date().toISOString(),
        SubjectId: actor(req),
        Action: action,
        ProjectCode: req.params.projectId,
        EntityName: details.entityName ?? null,
        EntityId: details.entityId ?? null,
        Severity: details.severity ?? "info",
        Details: { traceId: req.requestId, ...details },
      }, actor(req));
    } catch {
      console.error(`[${req.requestId}] ckmAudit failed for ${action}`);
    }
  };

  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const byKey = (pid, column, value) => [...byProject(pid), { column, op: "eq", value }];
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      await handler(req, res, r, req.params.projectId);
    } catch (err) {
      fail(req, res, err);
    }
  };

  async function loadAll(r, pid) {
    const w = { where: byProject(pid), limit: 5000 };
    const [letters, meetings, actions, stakeholders, lessons, reuses, rules] = await Promise.all([
      r.list("Correspondence", w), r.list("MeetingMinute", w), r.list("MeetingAction", w), r.list("Stakeholder", w),
      r.list("LessonLearned", w), r.list("LessonReuse", w), r.list("NotificationRule", w),
    ]);
    const by = (k, desc = false) => (a, b) => (desc ? -1 : 1) * String(a[k]).localeCompare(String(b[k]), "en", { numeric: true });
    return {
      letters: letters.sort(by("IssuedAt", true)), meetings: meetings.sort(by("HeldAt", true)), actions: actions.sort(by("Code")),
      stakeholders: stakeholders.sort(by("Code")), lessons: lessons.sort(by("Code")), reuses: reuses.sort(by("UsedAt", true)), rules: rules.sort(by("Code")),
    };
  }

  async function must(r, table, pid, column, value, label) {
    const row = await r.findOne(table, byKey(pid, column, value));
    if (!row) throw notFound(`${label} ${value} یافت نشد`);
    return row;
  }

  /** ستون‌های مشتق نامه (مهلت و پرچم Time-Bar) همیشه سمت سرور. */
  const letterDerived = (row) => ({ DueAt: letterDueDate(row, todayIso()), TimeBarred: isTimeBarred(row.Kind) });

  const base = "/api/ckm/:projectId";

  /* ═══════════ خواندن ═══════════ */

  app.get(`${base}/workspace`, need(VIEW_PERMS), route(async (req, res, r, pid) => {
    const all = await loadAll(r, pid);
    const subject = subjectOf(req);
    const enforce = String(process.env.CKM_RBAC_ENFORCE ?? "1") !== "0";
    const canLetters = !enforce || allows(subject, "ckm.letter.view");
    ok(req, res, {
      projectId: pid,
      today: todayIso(),
      lettersHidden: !canLetters,
      ...all,
      letters: canLetters ? all.letters : [],
    });
  }));

  /* ═══════════ دادهٔ نمونه ═══════════ */

  app.post(`${base}/seed`, need("ckm.letter.draft"), route(async (req, res, r, pid) => {
    const all = await loadAll(r, pid);
    const count = Object.values(all).reduce((a, xs) => a + xs.length, 0);
    if (count > 0) throw conflict("E-CKM-NOT-EMPTY", "پروژه داده دارد؛ دادهٔ نمونه فقط روی پروژهٔ خالی بارگذاری می‌شود");
    const u = actor(req);
    const today = todayIso();
    const S = ckmSampleFor(today);
    for (const l of S.letters) await r.create("Correspondence", { ProjectId: pid, ...l, ...letterDerived(l), SignedAt: l.SignedBy ? `${l.IssuedAt}T08:00:00.000Z` : null }, u, "cor");
    for (const m of S.meetings) await r.create("MeetingMinute", { ProjectId: pid, ...m, ApprovedAt: m.ApprovedAt ? `${m.ApprovedAt}T08:00:00.000Z` : null }, u, "mtg");
    for (const a of S.actions) await r.create("MeetingAction", { ProjectId: pid, ...a }, u, "act");
    for (const s of S.stakeholders) await r.create("Stakeholder", { ProjectId: pid, ...s }, u, "stk");
    for (const l of S.lessons) await r.create("LessonLearned", { ProjectId: pid, ...l, Value: lessonValue(toLesson(l)), ValidatedAt: l.Validated ? `${l.CapturedAt}T08:00:00.000Z` : null }, u, "les");
    for (const x of S.rules) await r.create("NotificationRule", { ProjectId: pid, ...x }, u, "nr");
    await audit(r, req, "CKM_SAMPLE_SEEDED", { entityName: "CkmWorkspace", entityId: pid, shiftedTo: today });
    ok(req, res, { seeded: true, today }, 201);
  }));

  /* ═══════════ مکاتبات ═══════════ */

  app.post(`${base}/letters`, need("ckm.letter.draft"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const today = todayIso();
    const Direction = oneOf(b.Direction, "جهت", ["incoming", "outgoing"]);
    const row = {
      LetterNo: code(b.LetterNo, "شماره نامه"),
      Direction,
      Kind: oneOf(b.Kind, "نوع نامه", LETTER_CLASSES),
      SubjectFa: text(b.SubjectFa, "موضوع", { max: 500, required: true }),
      FromParty: text(b.FromParty, "فرستنده", { max: 200, required: true }),
      ToParty: text(b.ToParty, "گیرنده", { max: 200, required: true }),
      IssuedAt: date(b.IssuedAt, "تاریخ نامه") ?? today,
      ReceivedAt: date(b.ReceivedAt, "تاریخ ثبت دبیرخانه"),
      ResponseDays: int(b.ResponseDays, "مهلت پاسخ (روز کاری)", { min: 1, max: 365 }),
      Links: list(b.Links, "ارجاع‌ها", { itemMax: 60 }),
      OwnerRole: text(b.OwnerRole, "مالک پاسخ", { max: 80 }),
      Attachments: int(b.Attachments, "پیوست", { min: 0, max: 999 }),
      RefLetterNo: text(b.RefLetterNo, "پیرو/عطف", { max: 80 }),
      DraftedBy: actor(req),
    };
    if (row.IssuedAt > today) throw bad("E-CKM-FUTURE-DATE", "تاریخ نامه نمی‌تواند در آینده باشد", { field: "IssuedAt" });
    if (row.ReceivedAt && (row.ReceivedAt < row.IssuedAt || row.ReceivedAt > today)) {
      throw bad("E-CKM-RECEIVED-RANGE", "تاریخ ثبت دبیرخانه باید میان تاریخ نامه و امروز باشد", { field: "ReceivedAt" });
    }
    /* وارده همان لحظه در دبیرخانه ثبت می‌شود؛ صادره تا امضا پیش‌نویس است. */
    row.Status = Direction === "incoming" ? "registered" : "draft";
    const issues = validateLetter(toLetter(row));
    /* اعلان قراردادی صادره می‌تواند بدون ارجاع پیش‌نویس شود ولی بدون آن امضا نمی‌شود. */
    assertEngine(Direction === "incoming" ? issues : issues.filter((i) => i.code !== "E-CKM-103"));

    const created = await r.create("Correspondence", { ProjectId: pid, ...row, ...letterDerived(row) }, actor(req), "cor");
    // PAT-1: auto inbox for owner role — find users with that role
    try {
      if(row.OwnerRole){
        const { DEMO_SUBJECTS } = await import("./rbacLogic.js");
        const matched = DEMO_SUBJECTS.filter(u=> u.roles && (u.roles.includes(row.OwnerRole) || u.displayName===row.OwnerRole || u.roles.some(rr=> row.OwnerRole.includes(rr))));
        // fallback: if OwnerRole is a role name like "مدیر قرارداد" mapped to role? Use displayName matching or role
        // For simplicity, also create inbox for all doc_controllers if no match
        const targets = matched.length ? matched : DEMO_SUBJECTS.filter(u=> u.id!==actor(req)).slice(0,3);
        for(const tgt of targets.slice(0,5)){
          const inboxId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await r.create("CkmInboxItem", {
            Id: inboxId,
            ProjectId: pid,
            RecipientUserId: tgt.id,
            Type: "letter",
            ReferenceId: row.LetterNo,
            TitleFa: `نامه ${row.LetterNo}: ${row.SubjectFa.slice(0,80)}`,
            DueAt: row.DueAt || null,
            Status: "unread",
            CreatedAt: new Date().toISOString(),
            ReadAt: null,
            DoneAt: null,
            Priority: isTimeBarred(row.Kind) ? "high" : "normal",
          }, actor(req), "inb");
        }
      }
    } catch(e){ console.error('inbox auto create failed', e); }
    await audit(r, req, "CKM_LETTER_CREATED", { entityName: "Correspondence", entityId: row.LetterNo, status: row.Status, kind: row.Kind });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/letters/:no`, need("ckm.letter.draft"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Correspondence", pid, "LetterNo", req.params.no, "نامهٔ");
    if (cur.Status === "closed") throw conflict("E-CKM-LETTER-CLOSED", "نامهٔ بسته‌شده قابل ویرایش نیست");
    const b = req.body ?? {};
    const patch = {};
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    if (has("OwnerRole")) patch.OwnerRole = text(b.OwnerRole, "مالک پاسخ", { max: 80 });
    if (has("Links")) patch.Links = list(b.Links, "ارجاع‌ها", { itemMax: 60 });
    if (has("Attachments")) patch.Attachments = int(b.Attachments, "پیوست", { min: 0, max: 999 });
    if (has("RefLetterNo")) patch.RefLetterNo = text(b.RefLetterNo, "پیرو/عطف", { max: 80 });
    if (has("ResponseDays")) patch.ResponseDays = int(b.ResponseDays, "مهلت پاسخ (روز کاری)", { min: 1, max: 365 });
    /* متن و طرفین فقط تا پیش از امضا/ثبت قابل تغییرند. */
    for (const [k, label, max] of [["SubjectFa", "موضوع", 500], ["ToParty", "گیرنده", 200], ["FromParty", "فرستنده", 200]]) {
      if (!has(k)) continue;
      if (cur.Status !== "draft") throw conflict("E-CKM-LETTER-REGISTERED", "متن و طرفین نامهٔ ثبت‌شده تغییر نمی‌کند");
      patch[k] = text(b[k], label, { max, required: true });
    }
    if (has("Kind")) {
      if (cur.Status !== "draft") throw conflict("E-CKM-LETTER-REGISTERED", "نوع نامهٔ ثبت‌شده تغییر نمی‌کند");
      patch.Kind = oneOf(b.Kind, "نوع نامه", LETTER_CLASSES);
    }
    if (!Object.keys(patch).length) throw bad("E-CKM-EMPTY-PATCH", "تغییری ارسال نشده");
    const next = { ...cur, ...patch };
    const issues = validateLetter(toLetter(next));
    assertEngine(cur.Status === "draft" ? issues.filter((i) => i.code !== "E-CKM-103") : issues);
    await r.patch("Correspondence", cur.Id, { ...patch, ...letterDerived(next) }, actor(req));
    await audit(r, req, "CKM_LETTER_UPDATED", { entityName: "Correspondence", entityId: cur.LetterNo, fields: Object.keys(patch) });
    ok(req, res, await r.get("Correspondence", cur.Id));
  }));

  /** امضا و صدور نامهٔ صادره — تفکیک وظیفه: امضاکننده ≠ تهیه‌کننده. */
  app.post(`${base}/letters/:no/issue`, need("ckm.letter.sign"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Correspondence", pid, "LetterNo", req.params.no, "نامهٔ");
    if (cur.Direction !== "outgoing") throw conflict("E-CKM-NOT-OUTGOING", "فقط نامهٔ صادره امضا و صادر می‌شود");
    if (cur.Status !== "draft") throw conflict("E-CKM-ALREADY-ISSUED", "این نامه قبلاً صادر شده است");
    if (cur.DraftedBy && cur.DraftedBy === actor(req)) {
      throw forbidden("E-CKM-SOD", "تهیه‌کنندهٔ نامه نمی‌تواند خودش آن را امضا کند (تفکیک وظیفه)", { draftedBy: cur.DraftedBy });
    }
    const today = todayIso();
    const IssuedAt = date(req.body?.IssuedAt, "تاریخ صدور") ?? today;
    if (IssuedAt > today) throw bad("E-CKM-FUTURE-DATE", "تاریخ صدور نمی‌تواند در آینده باشد", { field: "IssuedAt" });
    const next = { ...cur, IssuedAt, Status: "registered" };
    assertEngine(validateLetter(toLetter(next)));
    await r.patch("Correspondence", cur.Id, { IssuedAt, Status: "registered", SignedBy: actor(req), SignedAt: new Date().toISOString(), ...letterDerived(next) }, actor(req));
    await audit(r, req, "CKM_LETTER_ISSUED", { entityName: "Correspondence", entityId: cur.LetterNo, severity: isTimeBarred(cur.Kind) ? "warning" : "info" });
    ok(req, res, await r.get("Correspondence", cur.Id));
  }));

  app.post(`${base}/letters/:no/respond`, need("ckm.letter.draft"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Correspondence", pid, "LetterNo", req.params.no, "نامهٔ");
    if (cur.Status !== "registered" && cur.Status !== "under_review") throw conflict("E-CKM-BAD-STATE", "پاسخ فقط برای نامهٔ ثبت‌شده و بی‌پاسخ ثبت می‌شود", { status: cur.Status });
    const today = todayIso();
    const RespondedAt = date(req.body?.RespondedAt, "تاریخ پاسخ") ?? today;
    const start = isoDay(cur.ReceivedAt) ?? isoDay(cur.IssuedAt);
    if (RespondedAt < start || RespondedAt > today) throw bad("E-CKM-RESPONSE-RANGE", "تاریخ پاسخ باید میان تاریخ ثبت نامه و امروز باشد", { field: "RespondedAt" });
    const ResponseRef = text(req.body?.ResponseRef, "شمارهٔ نامهٔ پاسخ", { max: 80 });
    await r.patch("Correspondence", cur.Id, { RespondedAt, ResponseRef, Status: "responded" }, actor(req));
    await audit(r, req, "CKM_LETTER_RESPOND", { entityName: "Correspondence", entityId: cur.LetterNo, respondedAt: RespondedAt, dueAt: isoDay(cur.DueAt) });
    ok(req, res, await r.get("Correspondence", cur.Id));
  }));

  app.post(`${base}/letters/:no/close`, need("ckm.letter.draft"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Correspondence", pid, "LetterNo", req.params.no, "نامهٔ");
    if (cur.Status === "closed") throw conflict("E-CKM-LETTER-CLOSED", "نامه قبلاً بسته شده است");
    if (cur.Status === "draft") throw conflict("E-CKM-BAD-STATE", "پیش‌نویس بسته نمی‌شود؛ حذفش کنید");
    const reasonFa = text(req.body?.reasonFa, "دلیل بستن", { max: 400 });
    if (cur.Status !== "responded") {
      if (isTimeBarred(cur.Kind)) throw conflict("E-CKM-UNANSWERED-NOTICE", "اعلان قراردادی بدون ثبت پاسخ بسته نمی‌شود");
      if (!reasonFa) throw bad("E-CKM-REASON-REQUIRED", "بستن نامهٔ بی‌پاسخ دلیل می‌خواهد", { field: "reasonFa" });
    }
    await r.patch("Correspondence", cur.Id, { Status: "closed" }, actor(req));
    await audit(r, req, "CKM_LETTER_CLOSED", { entityName: "Correspondence", entityId: cur.LetterNo, reasonFa });
    ok(req, res, await r.get("Correspondence", cur.Id));
  }));

  app.delete(`${base}/letters/:no`, need("ckm.letter.draft"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Correspondence", pid, "LetterNo", req.params.no, "نامهٔ");
    if (cur.Status !== "draft") throw conflict("E-CKM-LETTER-REGISTERED", "نامهٔ ثبت‌شده حذف نمی‌شود؛ فقط بسته می‌شود");
    await r.remove("Correspondence", cur.Id);
    await audit(r, req, "CKM_LETTER_DELETED", { entityName: "Correspondence", entityId: cur.LetterNo });
    ok(req, res, { deleted: cur.LetterNo });
  }));

  /* ═══════════ جلسات و مصوبات ═══════════ */

  app.post(`${base}/meetings`, need("ckm.meeting.record"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const row = {
      Code: code(b.Code, "کد جلسه"),
      TitleFa: text(b.TitleFa, "عنوان جلسه", { max: 300, required: true }),
      MeetingType: oneOf(b.MeetingType, "نوع جلسه", MEETING_TYPES),
      HeldAt: date(b.HeldAt, "تاریخ جلسه", { required: true }),
      Chair: text(b.Chair, "رئیس جلسه", { max: 120, required: true }),
      Invited: list(b.Invited, "دعوت‌شدگان"),
      Attendees: list(b.Attendees, "حاضران"),
      MinutesApproved: false,
      RecordedBy: actor(req),
    };
    if (row.HeldAt > todayIso()) throw bad("E-CKM-FUTURE-MEETING", "صورت‌جلسه برای جلسهٔ برگزارشده ثبت می‌شود؛ تاریخ آینده مجاز نیست", { field: "HeldAt" });
    if (!row.Invited.length) throw bad("E-CKM-NO-INVITED", "فهرست دعوت‌شدگان خالی است", { field: "Invited" });
    const created = await r.create("MeetingMinute", { ProjectId: pid, ...row }, actor(req), "mtg");
    await audit(r, req, "CKM_MEETING_RECORDED", { entityName: "MeetingMinute", entityId: row.Code });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/meetings/:code`, need("ckm.meeting.record"), route(async (req, res, r, pid) => {
    const cur = await must(r, "MeetingMinute", pid, "Code", req.params.code, "جلسهٔ");
    if (cur.MinutesApproved) throw conflict("E-CKM-MINUTES-LOCKED", "صورت‌جلسهٔ تصویب‌شده قفل است");
    const b = req.body ?? {};
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const patch = {};
    if (has("TitleFa")) patch.TitleFa = text(b.TitleFa, "عنوان جلسه", { max: 300, required: true });
    if (has("Chair")) patch.Chair = text(b.Chair, "رئیس جلسه", { max: 120, required: true });
    if (has("Invited")) patch.Invited = list(b.Invited, "دعوت‌شدگان");
    if (has("Attendees")) patch.Attendees = list(b.Attendees, "حاضران");
    if (patch.Invited && !patch.Invited.length) throw bad("E-CKM-NO-INVITED", "فهرست دعوت‌شدگان خالی است", { field: "Invited" });
    if (!Object.keys(patch).length) throw bad("E-CKM-EMPTY-PATCH", "تغییری ارسال نشده");
    await r.patch("MeetingMinute", cur.Id, patch, actor(req));
    await audit(r, req, "CKM_MEETING_UPDATED", { entityName: "MeetingMinute", entityId: cur.Code, fields: Object.keys(patch) });
    ok(req, res, await r.get("MeetingMinute", cur.Id));
  }));

  app.post(`${base}/meetings/:code/approve`, need("ckm.meeting.record"), route(async (req, res, r, pid) => {
    const cur = await must(r, "MeetingMinute", pid, "Code", req.params.code, "جلسهٔ");
    if (cur.MinutesApproved) throw conflict("E-CKM-ALREADY-APPROVED", "صورت‌جلسه قبلاً تصویب شده است");
    if (cur.RecordedBy && cur.RecordedBy === actor(req)) {
      throw forbidden("E-CKM-SOD", "ثبت‌کنندهٔ صورت‌جلسه نمی‌تواند خودش آن را تصویب کند (تفکیک وظیفه)", { recordedBy: cur.RecordedBy });
    }
    await r.patch("MeetingMinute", cur.Id, { MinutesApproved: true, ApprovedBy: actor(req), ApprovedAt: new Date().toISOString() }, actor(req));
    await audit(r, req, "CKM_MINUTES_APPROVED", { entityName: "MeetingMinute", entityId: cur.Code });
    ok(req, res, await r.get("MeetingMinute", cur.Id));
  }));

  app.post(`${base}/meetings/:code/distribute`, need("ckm.meeting.record"), route(async (req, res, r, pid) => {
    const cur = await must(r, "MeetingMinute", pid, "Code", req.params.code, "جلسهٔ");
    if (!cur.MinutesApproved) throw conflict("E-CKM-NOT-APPROVED", "صورت‌جلسهٔ تصویب‌نشده توزیع نمی‌شود");
    const given = list(req.body?.recipients, "گیرندگان");
    const recipients = given.length ? given : Array.from(new Set([...(cur.Invited ?? []), ...(cur.Attendees ?? [])]));
    await r.patch("MeetingMinute", cur.Id, { DistributedAt: todayIso(), DistributedTo: recipients }, actor(req));
    await audit(r, req, "CKM_MINUTES_DISTRIBUTED", { entityName: "MeetingMinute", entityId: cur.Code, recipients: recipients.length });
    ok(req, res, await r.get("MeetingMinute", cur.Id));
  }));

  app.delete(`${base}/meetings/:code`, need("ckm.meeting.record"), route(async (req, res, r, pid) => {
    const cur = await must(r, "MeetingMinute", pid, "Code", req.params.code, "جلسهٔ");
    if (cur.MinutesApproved) throw conflict("E-CKM-MINUTES-LOCKED", "صورت‌جلسهٔ تصویب‌شده حذف نمی‌شود");
    const acts = await r.list("MeetingAction", { where: byKey(pid, "MeetingCode", cur.Code), limit: 5000 });
    for (const a of acts) await r.remove("MeetingAction", a.Id);
    await r.remove("MeetingMinute", cur.Id);
    await audit(r, req, "CKM_MEETING_DELETED", { entityName: "MeetingMinute", entityId: cur.Code, actions: acts.length });
    ok(req, res, { deleted: cur.Code, actions: acts.length });
  }));

  app.post(`${base}/meetings/:code/actions`, need("ckm.meeting.record"), route(async (req, res, r, pid) => {
    const m = await must(r, "MeetingMinute", pid, "Code", req.params.code, "جلسهٔ");
    if (m.MinutesApproved) throw conflict("E-CKM-MINUTES-LOCKED", "صورت‌جلسهٔ تصویب‌شده قفل است؛ مصوبهٔ جدید در جلسهٔ بعد ثبت شود");
    const b = req.body ?? {};
    const rows = await r.list("MeetingAction", { where: byProject(pid), limit: 5000 });
    const used = new Set(rows.map((x) => x.Code));
    let i = rows.length + 1;
    while (used.has(`ACT-${String(i).padStart(3, "0")}`)) i++;
    const row = {
      Code: `ACT-${String(i).padStart(3, "0")}`,
      MeetingCode: m.Code,
      TitleFa: text(b.TitleFa, "شرح مصوبه", { max: 500 }) ?? "",
      OwnerRole: text(b.OwnerRole, "مالک", { max: 80 }) ?? "",
      DueDate: date(b.DueDate, "موعد") ?? "",
      Status: "open",
      Links: list(b.Links, "ارجاع‌ها", { itemMax: 60 }),
    };
    assertEngine(validateAction(toAction(row)));
    if (!row.TitleFa) throw bad("E-CKM-REQUIRED", "«شرح مصوبه» الزامی است", { field: "TitleFa" });
    if (row.DueDate < isoDay(m.HeldAt)) throw bad("E-CKM-DUE-BEFORE-MEETING", "موعد مصوبه پیش از تاریخ جلسه است", { field: "DueDate" });
    const created = await r.create("MeetingAction", { ProjectId: pid, ...row }, actor(req), "act");
    await audit(r, req, "CKM_ACTION_CREATED", { entityName: "MeetingAction", entityId: row.Code, meeting: m.Code });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/actions/:code`, need("ckm.meeting.record"), route(async (req, res, r, pid) => {
    const cur = await must(r, "MeetingAction", pid, "Code", req.params.code, "مصوبهٔ");
    if (cur.Status === "done" || cur.Status === "cancelled") throw conflict("E-CKM-ACTION-CLOSED", "مصوبهٔ بسته یا لغوشده تغییر نمی‌کند");
    const b = req.body ?? {};
    const Status = oneOf(b.Status, "وضعیت", ACTION_STATUSES.filter((s) => s !== "open"));
    const patch = { Status };
    if (Status === "done") patch.ClosedAt = todayIso();
    if (Status === "cancelled") patch.CancelReasonFa = text(b.reasonFa, "دلیل لغو", { max: 400, required: true });
    await r.patch("MeetingAction", cur.Id, patch, actor(req));
    await audit(r, req, Status === "done" ? "CKM_ACTION_CLOSE" : Status === "cancelled" ? "CKM_ACTION_CANCEL" : "CKM_ACTION_START", {
      entityName: "MeetingAction", entityId: cur.Code, reasonFa: patch.CancelReasonFa ?? null,
    });
    ok(req, res, await r.get("MeetingAction", cur.Id));
  }));

  /* ═══════════ ذی‌نفعان ═══════════ */

  function stakeholderFields(b, partial) {
    const has = (k) => !partial || Object.prototype.hasOwnProperty.call(b, k);
    const out = {};
    if (has("NameFa")) out.NameFa = text(b.NameFa, "نام", { max: 300, required: true });
    if (has("Org")) out.Org = text(b.Org, "سازمان", { max: 120 });
    if (has("RoleFa")) out.RoleFa = text(b.RoleFa, "نقش", { max: 120 });
    if (has("Power")) out.Power = int(b.Power, "قدرت", { min: 1, max: 5, required: true });
    if (has("Interest")) out.Interest = int(b.Interest, "علاقه", { min: 1, max: 5, required: true });
    if (has("CurrentLevel")) out.CurrentLevel = oneOf(b.CurrentLevel, "تعامل فعلی", ENGAGEMENT_LEVELS);
    if (has("DesiredLevel")) out.DesiredLevel = oneOf(b.DesiredLevel, "تعامل مطلوب", ENGAGEMENT_LEVELS);
    if (has("Channels")) out.Channels = list(b.Channels, "کانال‌ها", { max: 10, itemMax: 60 });
    if (has("Frequency")) out.Frequency = oneOf(b.Frequency, "تناوب", FREQUENCIES, { required: false });
    if (has("OwnerRole")) out.OwnerRole = text(b.OwnerRole, "مسئول ارتباط", { max: 80 });
    return out;
  }

  app.post(`${base}/stakeholders`, need("ckm.stakeholder.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const row = { Code: code(b.Code, "کد ذی‌نفع"), ...stakeholderFields(b, false) };
    const created = await r.create("Stakeholder", { ProjectId: pid, ...row }, actor(req), "stk");
    await audit(r, req, "CKM_STAKEHOLDER_CREATED", { entityName: "Stakeholder", entityId: row.Code });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/stakeholders/:code`, need("ckm.stakeholder.edit"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Stakeholder", pid, "Code", req.params.code, "ذی‌نفع");
    const patch = stakeholderFields(req.body ?? {}, true);
    if (!Object.keys(patch).length) throw bad("E-CKM-EMPTY-PATCH", "تغییری ارسال نشده");
    await r.patch("Stakeholder", cur.Id, patch, actor(req));
    await audit(r, req, "CKM_STAKEHOLDER_UPDATED", { entityName: "Stakeholder", entityId: cur.Code, fields: Object.keys(patch) });
    ok(req, res, await r.get("Stakeholder", cur.Id));
  }));

  app.delete(`${base}/stakeholders/:code`, need("ckm.stakeholder.edit"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Stakeholder", pid, "Code", req.params.code, "ذی‌نفع");
    await r.remove("Stakeholder", cur.Id);
    await audit(r, req, "CKM_STAKEHOLDER_DELETED", { entityName: "Stakeholder", entityId: cur.Code });
    ok(req, res, { deleted: cur.Code });
  }));

  /* ═══════════ دانش و درس‌آموخته ═══════════ */

  function lessonFields(b, partial) {
    const has = (k) => !partial || Object.prototype.hasOwnProperty.call(b, k);
    const out = {};
    if (has("TitleFa")) out.TitleFa = text(b.TitleFa, "عنوان", { max: 400, required: true });
    if (has("Category")) out.Category = oneOf(b.Category, "حوزه", LESSON_CATEGORIES);
    if (has("Impact")) out.Impact = oneOf(b.Impact, "اثر", IMPACTS);
    if (has("SourceRef")) out.SourceRef = text(b.SourceRef, "منشأ", { max: 80 });
    if (has("SituationFa")) out.SituationFa = text(b.SituationFa, "شرح وضعیت", { max: 2000 });
    if (has("RecommendationFa")) out.RecommendationFa = text(b.RecommendationFa, "توصیه", { max: 2000 });
    if (has("Tags")) out.Tags = list(b.Tags, "برچسب‌ها", { max: 12, itemMax: 40 });
    return out;
  }

  app.post(`${base}/lessons`, need("ckm.lesson.publish"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const row = {
      Code: code(b.Code, "کد درس"), ...lessonFields(b, false),
      CapturedAt: todayIso(), CapturedBy: actor(req), Validated: false, ReuseCount: 0,
    };
    assertEngine(validateLesson(toLesson(row)));
    row.Value = lessonValue(toLesson(row));
    const created = await r.create("LessonLearned", { ProjectId: pid, ...row }, actor(req), "les");
    await audit(r, req, "CKM_LESSON_CAPTURED", { entityName: "LessonLearned", entityId: row.Code, sourceRef: row.SourceRef });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/lessons/:code`, need("ckm.lesson.publish"), route(async (req, res, r, pid) => {
    const cur = await must(r, "LessonLearned", pid, "Code", req.params.code, "درس‌آموختهٔ");
    if (cur.Validated) throw conflict("E-CKM-LESSON-LOCKED", "درس تأییدشده ویرایش نمی‌شود");
    const patch = lessonFields(req.body ?? {}, true);
    if (!Object.keys(patch).length) throw bad("E-CKM-EMPTY-PATCH", "تغییری ارسال نشده");
    const next = { ...cur, ...patch };
    assertEngine(validateLesson(toLesson(next)));
    await r.patch("LessonLearned", cur.Id, { ...patch, Value: lessonValue(toLesson(next)) }, actor(req));
    await audit(r, req, "CKM_LESSON_UPDATED", { entityName: "LessonLearned", entityId: cur.Code, fields: Object.keys(patch) });
    ok(req, res, await r.get("LessonLearned", cur.Id));
  }));

  app.post(`${base}/lessons/:code/validate`, need("ckm.lesson.publish"), route(async (req, res, r, pid) => {
    const cur = await must(r, "LessonLearned", pid, "Code", req.params.code, "درس‌آموختهٔ");
    if (cur.Validated) throw conflict("E-CKM-ALREADY-VALIDATED", "این درس قبلاً تأیید شده است");
    if (cur.CapturedBy && cur.CapturedBy === actor(req)) {
      throw forbidden("E-CKM-SOD", "ثبت‌کنندهٔ درس نمی‌تواند خودش آن را تأیید کند (تفکیک وظیفه)", { capturedBy: cur.CapturedBy });
    }
    const next = { ...cur, Validated: true };
    await r.patch("LessonLearned", cur.Id, { Validated: true, ValidatedBy: actor(req), ValidatedAt: new Date().toISOString(), Value: lessonValue(toLesson(next)) }, actor(req));
    await audit(r, req, "CKM_LESSON_VALIDATE", { entityName: "LessonLearned", entityId: cur.Code });
    ok(req, res, await r.get("LessonLearned", cur.Id));
  }));

  /** استفادهٔ مجدد: هر کاربر یک بار، فقط از درس تأییدشده، با شرح نحوهٔ استفاده. */
  app.post(`${base}/lessons/:code/reuse`, need(VIEW_PERMS), route(async (req, res, r, pid) => {
    const cur = await must(r, "LessonLearned", pid, "Code", req.params.code, "درس‌آموختهٔ");
    if (!cur.Validated) throw conflict("E-CKM-LESSON-NOT-VALIDATED", "درس تأییدنشده در بانک دانش قابل استفاده نیست");
    const NoteFa = text(req.body?.noteFa, "شرح استفاده", { max: 600, required: true, min: 10 });
    const who = actor(req);
    const dup = await r.findOne("LessonReuse", [...byKey(pid, "LessonCode", cur.Code), { column: "UsedBy", op: "eq", value: who }]);
    if (dup) throw conflict("E-CKM-ALREADY-REUSED", "استفادهٔ شما از این درس قبلاً ثبت شده است");
    await r.create("LessonReuse", { ProjectId: pid, LessonCode: cur.Code, UsedBy: who, UsedAt: todayIso(), NoteFa }, who, "lru");
    const next = { ...cur, ReuseCount: (Number(cur.ReuseCount) || 0) + 1 };
    await r.patch("LessonLearned", cur.Id, { ReuseCount: next.ReuseCount, Value: lessonValue(toLesson(next)) }, who);
    await audit(r, req, "CKM_LESSON_REUSE", { entityName: "LessonLearned", entityId: cur.Code, reuseCount: next.ReuseCount });
    ok(req, res, await r.get("LessonLearned", cur.Id));
  }));

  app.delete(`${base}/lessons/:code`, need("ckm.lesson.publish"), route(async (req, res, r, pid) => {
    const cur = await must(r, "LessonLearned", pid, "Code", req.params.code, "درس‌آموختهٔ");
    if (cur.Validated) throw conflict("E-CKM-LESSON-LOCKED", "درس تأییدشده حذف نمی‌شود");
    await r.remove("LessonLearned", cur.Id);
    await audit(r, req, "CKM_LESSON_DELETED", { entityName: "LessonLearned", entityId: cur.Code });
    ok(req, res, { deleted: cur.Code });
  }));

  /* ═══════════ قواعد اطلاع‌رسانی ═══════════ */

  function ruleFields(b, partial) {
    const has = (k) => !partial || Object.prototype.hasOwnProperty.call(b, k);
    const out = {};
    if (has("EventCode")) out.EventCode = oneOf(b.EventCode, "رویداد", EVENT_CODES);
    if (has("NameFa")) out.NameFa = text(b.NameFa, "عنوان قاعده", { max: 300, required: true });
    if (has("Channels")) out.Channels = list(b.Channels, "کانال‌ها", { max: 4, allowed: CHANNELS });
    if (has("AudienceRoles")) out.AudienceRoles = list(b.AudienceRoles, "مخاطبان", { max: 20, itemMax: 80 });
    if (has("EscalateAfterHours")) out.EscalateAfterHours = int(b.EscalateAfterHours, "ساعت تا تشدید", { min: 1, max: 720, required: true });
    if (has("EscalateToRole")) out.EscalateToRole = text(b.EscalateToRole, "مقصد تشدید", { max: 80 });
    if (has("Active")) out.Active = Boolean(b.Active);
    return out;
  }

  app.post(`${base}/rules`, need("ckm.notify.manage"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const row = { Code: code(b.Code, "کد قاعده"), ...ruleFields({ Active: true, ...b }, false) };
    if (!row.Channels.length) throw bad("E-CKM-NO-CHANNEL", "دست‌کم یک کانال لازم است", { field: "Channels" });
    const created = await r.create("NotificationRule", { ProjectId: pid, ...row }, actor(req), "nr");
    await audit(r, req, "CKM_RULE_CREATED", { entityName: "NotificationRule", entityId: row.Code, event: row.EventCode });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/rules/:code`, need("ckm.notify.manage"), route(async (req, res, r, pid) => {
    const cur = await must(r, "NotificationRule", pid, "Code", req.params.code, "قاعدهٔ");
    const patch = ruleFields(req.body ?? {}, true);
    if (!Object.keys(patch).length) throw bad("E-CKM-EMPTY-PATCH", "تغییری ارسال نشده");
    if (patch.Channels && !patch.Channels.length) throw bad("E-CKM-NO-CHANNEL", "دست‌کم یک کانال لازم است", { field: "Channels" });
    await r.patch("NotificationRule", cur.Id, patch, actor(req));
    await audit(r, req, "CKM_RULE_UPDATED", { entityName: "NotificationRule", entityId: cur.Code, fields: Object.keys(patch) });
    ok(req, res, await r.get("NotificationRule", cur.Id));
  }));

  /* ═══════════ PAT-1/2 کارتابل و ارجاعات ═══════════ */

  app.get(`${base}/inbox`, need(VIEW_PERMS), route(async (req, res, r, pid) => {
    const userId = actor(req);
    const where=[{ column: "ProjectId", op: "eq", value: pid }, { column: "RecipientUserId", op: "eq", value: userId }];
    if(req.query.status) where.push({ column: "Status", op: "eq", value: String(req.query.status) });
    if(req.query.type) where.push({ column: "Type", op: "eq", value: String(req.query.type) });
    const rows = await r.list("CkmInboxItem", { where, limit: 500 });
    rows.sort((a,b)=> String(b.CreatedAt||"").localeCompare(String(a.CreatedAt||"")));
    const unread = rows.filter(x=> x.Status==="unread").length;
    const overdue = rows.filter(x=> x.DueAt && new Date(x.DueAt) < new Date() && x.Status!=="done" && x.Status!=="archived").length;
    ok(req, res, { count: rows.length, summary: { unread, overdue, total: rows.length }, items: rows });
  }));

  app.post(`${base}/inbox/:id/read`, need(VIEW_PERMS), route(async (req, res, r, pid) => {
    const row = await r.findOne("CkmInboxItem", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if(!row) throw notFound(`کارتابل ${req.params.id} یافت نشد`);
    if(row.ProjectId!==pid) throw bad("E-CKM-PROJECT-MISMATCH", "پروژه ناهمخوان");
    const now = new Date().toISOString();
    const next = { ...row, Status: row.Status==="unread" ? "read" : row.Status, ReadAt: row.ReadAt || now };
    await r.upsert("CkmInboxItem", { Id: row.Id }, next, actor(req));
    ok(req, res, next);
  }));

  app.post(`${base}/inbox/:id/done`, need(VIEW_PERMS), route(async (req, res, r, pid) => {
    const row = await r.findOne("CkmInboxItem", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if(!row) throw notFound(`کارتابل ${req.params.id} یافت نشد`);
    const now = new Date().toISOString();
    const next = { ...row, Status: "done", DoneAt: now, ReadAt: row.ReadAt || now };
    await r.upsert("CkmInboxItem", { Id: row.Id }, next, actor(req));
    ok(req, res, next);
  }));

  app.get(`${base}/referrals`, need(VIEW_PERMS), route(async (req, res, r, pid) => {
    const where=[{ column: "ProjectId", op: "eq", value: pid }];
    if(req.query.letterNo) where.push({ column: "LetterNo", op: "eq", value: String(req.query.letterNo) });
    if(req.query.toUserId) where.push({ column: "ToUserId", op: "eq", value: String(req.query.toUserId) });
    if(req.query.status) where.push({ column: "Status", op: "eq", value: String(req.query.status) });
    const rows = await r.list("CkmReferral", { where, limit: 500 });
    rows.sort((a,b)=> String(b.CreatedAt||"").localeCompare(String(a.CreatedAt||"")));
    ok(req, res, { count: rows.length, items: rows });
  }));

  app.post(`${base}/letters/:no/refer`, need("ckm.letter.draft"), route(async (req, res, r, pid) => {
    const cur = await must(r, "Correspondence", pid, "LetterNo", req.params.no, "نامهٔ");
    const b = req.body ?? {};
    const toUserId = text(b.toUserId, "گیرنده ارجاع", { max: 60, required: true });
    const instruction = text(b.instructionFa, "دستور ارجاع", { max: 1000, required: true });
    const deadline = date(b.deadline, "مهلت");
    // check user exists
    const target = (await import("./rbacLogic.js")).DEMO_SUBJECTS.find(u=> u.id===toUserId);
    if(!target) throw notFound(`کاربر ${toUserId} یافت نشد`);
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const history = [{ at: now, by: actor(req), to: toUserId, instruction, deadline }];
    const row = {
      Id: id,
      ProjectId: pid,
      LetterNo: cur.LetterNo,
      FromUserId: actor(req),
      ToUserId: toUserId,
      InstructionFa: instruction,
      Deadline: deadline,
      Status: "open",
      CreatedAt: now,
      DoneAt: null,
      DoneNoteFa: null,
      HistoryJson: JSON.stringify(history),
    };
    await r.create("CkmReferral", row, actor(req), "ref");
    // inbox for target
    const inboxId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await r.create("CkmInboxItem", {
      Id: inboxId,
      ProjectId: pid,
      RecipientUserId: toUserId,
      Type: "referral",
      ReferenceId: cur.LetterNo,
      TitleFa: `ارجاع ${cur.LetterNo}: ${instruction.slice(0,80)}`,
      DueAt: deadline,
      Status: "unread",
      CreatedAt: now,
      ReadAt: null,
      DoneAt: null,
      Priority: "normal",
    }, actor(req), "inb");
    // also inbox for letter if owner changed? Keep simple
    await audit(r, req, "CKM_REFERRAL_CREATED", { entityName: "CkmReferral", entityId: id, letterNo: cur.LetterNo, toUserId });
    ok(req, res, row, 201);
  }));

  app.post(`${base}/referrals/:id/done`, need(VIEW_PERMS), route(async (req, res, r, pid) => {
    const cur = await must(r, "CkmReferral", pid, "Id", req.params.id, "ارجاع");
    if(cur.Status!=="open") throw conflict("E-CKM-REFERRAL-CLOSED", "ارجاع باز نیست");
    const note = text(req.body?.doneNoteFa, "نتیجه", { max: 1000 });
    const now = new Date().toISOString();
    let history = [];
    try { history = JSON.parse(cur.HistoryJson||"[]"); } catch {}
    history.push({ at: now, by: actor(req), action: "done", note });
    const next = { ...cur, Status: "done", DoneAt: now, DoneNoteFa: note, HistoryJson: JSON.stringify(history) };
    await r.patch("CkmReferral", cur.Id, { Status: "done", DoneAt: now, DoneNoteFa: note, HistoryJson: JSON.stringify(history) }, actor(req));
    // mark inbox done for this user
    const inboxRows = await r.list("CkmInboxItem", { where: [{ column: "ProjectId", op: "eq", value: pid }, { column: "ReferenceId", op: "eq", value: cur.LetterNo }, { column: "RecipientUserId", op: "eq", value: cur.ToUserId }, { column: "Type", op: "eq", value: "referral" }], limit: 50 });
    for(const ib of inboxRows){
      if(ib.Status!=="done") await r.patch("CkmInboxItem", ib.Id, { Status: "done", DoneAt: now, ReadAt: ib.ReadAt || now }, actor(req));
    }
    await audit(r, req, "CKM_REFERRAL_DONE", { entityName: "CkmReferral", entityId: cur.Id });
    ok(req, res, next);
  }));

    app.delete(`${base}/rules/:code`, need("ckm.notify.manage"), route(async (req, res, r, pid) => {
    const cur = await must(r, "NotificationRule", pid, "Code", req.params.code, "قاعدهٔ");
    await r.remove("NotificationRule", cur.Id);
    await audit(r, req, "CKM_RULE_DELETED", { entityName: "NotificationRule", entityId: cur.Code });
    ok(req, res, { deleted: cur.Code });
  }));
}
