# RCC Deliverable 3 — RegisterItem + Risk Planning & Identification

خلاصه ۳ خطی: هستهٔ TPT در V001 تثبیت شد. V002 برنامهٔ ریسک پروژه، RBS هفت‌ریشه + زیرشاخه، و ستون‌های Cause–Event–Effect روی `risk_register` 📌 را می‌افزاید. شناسایی از فرم شیشه‌ای موجود + ایمپورت اکسل (ظرف) بدون تغییر سایدبار اصلی.

---

## 1. RegisterItem — Abstract Base

شبه‌کد (TypeScript، هم‌تراز `src/services` بعدی — هنوز به UI وصل نشده):

```ts
export type ItemType = "risk" | "issue" | "change" | "claim";

export type RegisterItem = {
  id: string;
  projectId: string;
  itemType: ItemType;
  code: string;          // RSK-0041 …
  titleFa: string;
  titleEn?: string;
  status: string;
  ownerId?: string;
  sourceModule?: "pex" | "pma" | "pim" | "manual";
  sourceRef?: string;    // e.g. SPI | CIV-001 — عدد کپی نمی‌شود
};

export function spawn(type: ItemType, draft: Omit<RegisterItem, "id" | "itemType">): RegisterItem {
  return { id: crypto.randomUUID(), itemType: type, ...draft };
}
```

وراثت: **Table-Per-Type**. فرزند 📌 با `register_item_id`. مزیت: جستجوی مشترک، کد تکراری کمتر، مهاجرت بدون DROP.

Backward: UI فعلی بدون `register_item_id` کار می‌کند.

---

## 2. Risk Planning ✨

جدول `risk_management_plan` (PK = project_id):

| فیلد | پیش‌فرض | نقش |
|---|---|---|
| matrix_size | 5 | ۳ تا ۷ |
| scales | P,I = 1..5 | قابل تنظیم PMO |
| thresholds | 8 / 12 / 16 | رنگ Low/Med/High |
| review_frequency_d | 30 | پایش |

ماتریس: score = P × I ؛ رنگ از آستانهٔ پلن (نه هاردکد فعلی ۱۶/۹). 👁️ ماتریس موجود باید رنگ را از پلن بخواند.

---

## 3. RBS پیش‌فرض ✨

۷ دسته + نمونه زیرشاخه (V002 seed):

| ریشه | fa | نمونه فرزند |
|---|---|---|
| EXT | خارجی | FX، اقلیم |
| ORG | سازمانی | منابع |
| PM | مدیریت پروژه | یکپارچگی |
| TEC | فنی | طراحی |
| PRC | تدارکات | Long Lead |
| CON | ساخت | ماشین‌آلات |
| COM | راه‌اندازی | سیستم‌ها |

شناسایی: `risk_register.rbs_code` → `rbs.code`.

---

## 4. Identification 🔧 روی فرم موجود

ساختار اجباری **Cause → Event → Effect** (ستون‌های جدید NULLable).

| عنصر UI فعلی | 👁️ | تغییر |
|---|---|---|
| عنوان / P / I / مالک | نگه | — |
| سه فیلد C-E-E | افزودن | زیر عنوان |
| RBS select | افزودن | از جدول rbs |
| Trigger + Assumption | افزودن | متن |
| منبع | chip | PEX/PMA/PIM/دستی |
| Excel bulk | جدید در صفحه داخلی | ظرف؛ تأیید پیش‌نمایش |

نگاشت ایمپورت (ستون‌های پیشنهادی قالب داخلی): `Code | TitleFa | Cause | Event | Effect | P | I | Owner | RBS`

Pipeline: Load → Map → Validate (P,I 1–5، RBS موجود) → Preview → Confirm. ردیف نامعتبر وارد هسته نمی‌شود.

SWOT / Assumption: فیلد متن در همان رکورد تا F2 فرم جدا نشود.

Auto-populate قالب سازمانی: بعد از RBS؛ اولویت F1 پایین‌تر از C-E-E.

---

## 5. نگاشت زیرفرایند داخلی (نه سایدبار)

زیر `d4-p1`:

- 07.1 پلن + RBS  
- 07.2 شناسایی (+ Excel)

---

## 6. فایل‌ها

- `db/postgres/rcc/migrations/V002__rbs_and_identification.sql`
- این سند

UI کد در این تحویل دست نخورده (بازطراحی نه پرش به پیاده‌سازی کامل) تا شما تأیید کنید.

---

## 7. Loop روی D3

| Loop | |
|---|---|
| 1 | Plan + Identify (11.1–11.2) پوشش داده شد |
| 2 | Abstract + TPT + شبه‌کد |
| 3 | RBS ۷ دسته seed شد؛ Quant هنوز D4 |
| 4–5 | خارج از محدوده D3 |
| 6 | source_module روی هسته |
| 7 | — |
| 8 | — |
| 9 | نام risk_register حفظ |
| 10 | V002 فقط ADD COLUMN / CREATE جدید |

**Gap حل:** RBS + C-E-E DDL.  
**Gap باقی:** موتور Qual ۷بُعد و Monte Carlo → D4.

منتظر **Deliverable 4**.
