import test from "node:test";
import assert from "node:assert/strict";
import { validateChildRow } from "./changeMgmtLogic.js";

test("فاز ۸: PmisChangeImpacts — فیلدهای الزامی + طول واقعی", () => {
  /* فیلد الزامی */
  assert.equal(validateChildRow("PmisChangeImpacts", { ConclusionFa: "نتيجه" }).ok, false);
  assert.equal(validateChildRow("PmisChangeImpacts", { TopicFa: "موضوع" }).ok, false);
  /* معمولی درست */
  const ok = validateChildRow("PmisChangeImpacts", {
    TopicFa: "اثر تغییر بر فیلتراسیون آب‌سردکن",
    Aspect: "technical",
    ConclusionFa: "افزایش دبی ۱۲٪ با همان پمپ امکان‌پذیر است؛ نیاز به تست تثبیت لرزش دارد.",
    AssumptionsFa: "دمای محیط حداکثر ۴۵ درجه.",
    LimitationsFa: "اگر نوسان بار بیش از ۱۵٪ باشد اعتبار لغو می‌شود.",
    AffectedItemsJson: ["فیلتر A", "فیلتر B"],
  });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  /* Conclusion بیش از حد کوتاه — همه‌کاره نباشد */
  const short = validateChildRow("PmisChangeImpacts", { TopicFa: "موضوع واقعی", ConclusionFa: "ok" });
  assert.equal(short.ok, false);
  /* aspect‌های نامعتبر */
  const badAspect = validateChildRow("PmisChangeImpacts", { TopicFa: "موضوع کامل", Aspect: "alien", ConclusionFa: "نتیجه‌گیری کامل برای ردیف واقعی" });
  assert.equal(badAspect.ok, false);
  assert.match(badAspect.errors[0], /technical/);
});

test("فاز ۸: سایر جدول‌های فرزند impact-adjacent بدون تداخل کار می‌کنند", () => {
  assert.equal(validateChildRow("PmisChangeScheduleImpacts", { MethodFa: "پنجره‌ای", AssumptionsFa: "شرایط واقعی" }).ok, true);
  assert.equal(validateChildRow("PmisChangeRiskLinks", { LinkType: "threat", DescriptionFa: "ریسک واقعی" }).ok, true);
});
