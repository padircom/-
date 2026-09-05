# PEX Deliverable 12 — Alert + Workflow + API + MVP
خلاصه ۳ خط: هشدار JSON-rule هشت دسته. پنج گردش کار. REST ≥۵۰. MVP فازبندی F0–F6. سایدبار اصلی Arena بدون آیتم جدید.

D11 بدون بازخورد.

---

## AlertRule Engine
```json
{
  "id": "evm-spi",
  "category": "EVM",
  "severity": "Warning",
  "when": { "field": "SPI", "op": "<", "value": 0.9 },
  "channels": ["inapp", "email"],
  "escalation": [
    { "level": 1, "afterHours": 0, "role": "planner" },
    { "level": 2, "afterHours": 24, "role": "project_manager" },
    { "level": 3, "afterHours": 72, "role": "pmc" }
  ],
  "suggestedAction": "Variance analysis WF3",
  "link": { "kinds": ["CR", "RSK", "Action"] }
}
```
Ack اجباری Critical+. History قابل فیلتر. Dashboard صفحه d2.

**۸ دسته:** Milestone (D5×7) · CP (D6×9) · EVM SPI/CPI/EAC · Resource over-alloc/shortage · DPR>24h · Progress انحراف · Punch A نزدیک Handover · Productivity<80%.

کانال: In-App (موجود) + Email nodemailer · SMS/Push فاز بعد.

---

## پنج Workflow
| # | نام | State |
|---|---|---|
| 1 | Baseline Approval | Draft→Review→Approved→Locked |
| 2 | Progress | DPR Draft→Submit→Review→Approved |
| 3 | Variance | Open→CAM→PMO→CR/Closed |
| 4 | Work Auth | Request→CAM→PM→Issued |
| 5 | Deliverable Accept | Submitted→IR→PunchClear→Accepted |

هر Step: SLA، Escalation، Delegation یک‌سطح (مثل PIM D5). Period Close و Baseline Lock بدون Admin برگشت‌ناپذیر.

---

## API (≥50)  Base `/api/v1/pex`  JWT + ABAC پروژه
Envelope همان PIM.

**WBS 1–8:** GET/POST `/projects/{id}/wbs` · GET/PATCH `/wbs/{id}` · POST `/wbs/{id}/move` · POST `/wbs/import` · GET `/wbs/{id}/dictionary` · PUT dictionary · GET `/projects/{id}/ca` · POST `/ai/wbs/analyze` · POST `/ai/wbs/{reqId}/approve`

**Schedule 9–20:** GET activities · POST activity · PATCH · GET/POST rels · POST `/cpm/compute` · GET `/cpm/jobs/{id}` · GET/POST baselines · POST `/baselines/{id}/lock` · POST `/schedule/update` · POST `/periods/{id}/close` · GET/POST lookahead

**MS 21–26:** GET/POST milestones · PATCH dates (CR) · GET alerts · GET reports/{1-10} · GET dashboard-widget · GET penalty

**CP 27–31:** GET snapshots · GET snapshot/{id}/activities · GET float-trend · GET health · GET reports/{1-10}

**EVM/Cost 32–37:** GET budget · POST actuals · GET snapshots · GET cashflow · GET reserves · POST forecast-method

**Resource 38–43:** GET pool · POST assign · POST timesheet · POST timesheet/{id}/approve · GET materials/status · GET histogram

**Site 44–50:** POST dpr · POST dpr/{id}/submit · POST ir · POST punch · POST wo · POST handover · GET sync/conflicts

**PMS 51–54:** GET/PUT pms-config · GET roc-library · GET scurve · POST progress/approve

**Report/Alert 55–60:** POST reports/generate · GET templates · GET/POST alert-rules · GET alerts · POST alerts/{id}/ack · GET kpis

Webhooks: `milestone.achieved`, `alert.triggered`, `period.closed`, `baseline.locked`, `cpm.completed`. HMAC مثل PIM.

---

## فازبندی
| فاز | مدت | محتوا |
|---|---|---|
| F0 | ۲ هفته | Gap ماژول‌های موجود، نقش planner، قالب Excel/XER نمونه |
| F1 | ۸ هفته | WBS+Activity+CPM+Baseline+Import P6/MSP/Excel+Gantt صفحه d2 |
| F2 | ۶ هفته | RoC+DPR+PMS+S-Curve+Milestone |
| F3 | ۸ هفته | EVM+Cost+Resource+Variance WF |
| F4 | ۶ هفته | Site Ops+PWA+WO/IR/Punch+Lookahead |
| F5 | ۶ هفته | AI+Reports+لوگو+Word+Preview |
| F6 | ۶ هفته | Leveling, What-if, Health, ES, Cash Flow |

خارج: تغییر سایدبار اصلی، microservice، شکستن index.css.

---

## ۲۵+ User Story فاز F1 (SP)
1. As planner I enter d2 domain page so I see workspace not empty. AC: سایدبار اصلی همان فرآیندها. SP5 Must
2. As planner I CRUD WBS tree. Weight sum=1. SP8
3. Import Excel WBS vessel. SP5
4. Import P6 XER ExternalId kept. SP13
5. Import MSP XML predecessors. SP8
6. Activity register FS/SS/FF/SF+lag. SP8
7. Calendar+Iran holidays. SP5
8. Run CPM ES/EF/LS/LF/TF. SP13
9. Critical flagged TF≤0. SP3
10. Gantt BL bar + DataDate. SP8
11. Set baseline lock with permission. SP5
12. Reject BL edit without CR. SP5
13. Async CPM >20k job status. SP8
14. Cycle detect error. SP3
15. Look-ahead 2 week list. SP5
16. Fa/En labels Vazirmatn. SP2
17. Link activity to DMS doc. SP3
18. ABAC project scope 403. SP5
19. Audit activity create. SP2
20. Offline queue stub syncQueue. SP5
21. DCMA report stub 4 points min. SP5
22. Export Excel activities vessel. SP5
23. What-if sandbox copy no live mutate. SP8
24. DoD no lucide-new-shell / no sidebar items. SP2
25. Period open DataDate set. SP3
26. Near-critical threshold config read. SP2
27. Constraint SNET applied in CPM. SP5

DoD F1: AC سبز، CPM calendar-aware، Baseline lock، Import ExternalId، ظاهر سالم، تست cycle+IDOR.

تخمین F1 ~۱۳۰ SP ≈ ۸ هفته دو نفر.

---

## Self-Validation D12
L1–6 پوشش از طریق Alert/WF/Report API · L7 نام endpoint=Entity D2 · L8 F1 هشت هفته با برش (نه EVM کامل) واقع‌بین · L9 JWT, rate limit, baseline permission, progress approved.

**Gap:** SMS/Push F5+. OpenAPI PEX جدا بعد از تأیید. UI PlanningWorkspace هنوز پیاده نشده — بعد از تأیید D12 در صورت دستور کاربر.

---

PEX D1–D12 بسته طراحی کامل است.
