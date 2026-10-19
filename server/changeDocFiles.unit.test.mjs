import test from "node:test";
import assert from "node:assert/strict";
import {
  validateChangeUploadPayload,
  changeSafeDocFileName,
  publicChangeDocRow,
  CHANGE_DOC_KINDS,
  CHANGE_DOC_KIND_FA,
} from "./changeMgmtLogic.js";

test("فاز ۶: validateChangeUploadPayload — ورودی معتبر پذیرفته و پاک‌سازی می‌شود", () => {
  const ok = validateChangeUploadPayload({ TitleFa: "صورت‌جلسهٔ CCB", Kind: "decision", DocNo: " M-12 ", DocDate: "2026-10-19", NoteFa: " یادداشت " });
  assert.equal(ok.ok, true);
  assert.equal(ok.fields.titleFa, "صورت‌جلسهٔ CCB");
  assert.equal(ok.fields.kind, "decision");
  assert.equal(ok.fields.docNo, "M-12");
  assert.equal(ok.fields.docDate, "2026-10-19");
  assert.equal(ok.fields.noteFa, "یادداشت");
  /* بدون اختیاری‌ها → null */
  const bare = validateChangeUploadPayload({ TitleFa: "سند تست", Kind: "evidence" });
  assert.equal(bare.ok, true);
  assert.equal(bare.fields.docNo, null);
  assert.equal(bare.fields.docDate, null);
});

test("فاز ۶: validateChangeUploadPayload — رد ورودی نامعتبر با پیام واقعی", () => {
  assert.equal(validateChangeUploadPayload({ TitleFa: "اب", Kind: "decision" }).ok, false);
  assert.equal(validateChangeUploadPayload({ TitleFa: "عنوان معتبر", Kind: "unknown_kind" }).ok, false);
  assert.equal(validateChangeUploadPayload({ TitleFa: "عنوان معتبر", Kind: "decision", DocDate: "19/10/2026" }).ok, false);
  assert.equal(validateChangeUploadPayload({ TitleFa: "عنوان معتبر", Kind: "decision", DocNo: "X".repeat(61) }).ok, false);
  /* پیام خطا whitelist نوع را نشان می‌دهد */
  const bad = validateChangeUploadPayload({ TitleFa: "عنوان معتبر", Kind: "hack" });
  assert.match(bad.error, /supporting/);
});

test("فاز ۶: انواع سند با ترجمهٔ واقعی", () => {
  assert.deepEqual(CHANGE_DOC_KINDS, ["supporting", "decision", "instruction", "evidence", "correspondence"]);
  assert.equal(CHANGE_DOC_KIND_FA.decision, "سند تصمیم CCB");
});

test("فاز ۶: changeSafeDocFileName — مسیرگریزی و کنترل نویسه", () => {
  assert.equal(changeSafeDocFileName("..\\..\\etc\\passwd.txt"), "passwd.txt");
  assert.equal(changeSafeDocFileName("folder/dangerous:name?.pdf"), "dangerous_name_.pdf");
  assert.equal(changeSafeDocFileName(""), "file.bin");
  assert.equal(changeSafeDocFileName(null), "file.bin");
  assert.equal(changeSafeDocFileName("سند شماره دو.pdf"), "سند شماره دو.pdf");
  /* کنترل NUL باید حذف شود */
  assert.equal(changeSafeDocFileName(`a${String.fromCharCode(0)}b.txt`).includes(String.fromCharCode(0)), false);
});

test("فاز ۶: publicChangeDocRow — کلید ذخیره‌سازی داخلی هرگز لو نمی‌رود", () => {
  const row = { Id: 7, Code: "DOC-X", TitleFa: "سند", FileRef: "123-secret.bin", FileNameFa: "report.pdf", Sha256: "abc" };
  const pub = publicChangeDocRow(row);
  assert.equal(pub.Code, "DOC-X");
  assert.equal(pub.FileNameFa, "report.pdf");
  assert.equal(pub.Sha256, "abc"); /* sha256 عمومی است — کلید ذخیره‌سازی نیست */
  assert.equal("FileRef" in pub, false);
  assert.equal(row.FileRef, "123-secret.bin"); /* ردیف اصلی دست‌نخورده */
});
