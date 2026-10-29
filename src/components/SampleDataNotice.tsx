/**
 * نوار هشدار «دادهٔ نمونه» برای پنل‌هایی که هنوز به API/SQL وصل نیستند و با
 * دادهٔ ثابت داخل کد کار می‌کنند. هدف: کاربر عددهای نمایشی را واقعی نپندارد.
 * فقط نمایش است؛ هیچ داده یا منطق دامنه‌ای ندارد.
 */

export default function SampleDataNotice({ rtl, detail }: { rtl: boolean; detail?: string }) {
  return (
    <div
      role="note"
      className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[10px] font-light text-amber-200"
    >
      <span className="shrink-0 font-semibold">{rtl ? "دادهٔ نمونه" : "Sample data"}</span>
      <span className="tx2">
        {rtl
          ? "این صفحه هنوز به پایگاه داده وصل نیست و عددها نمایشی‌اند؛ ورودی شما ذخیره نمی‌شود."
          : "This view is not connected to the database yet; figures are illustrative and nothing you enter is saved."}
      </span>
      {detail && <span className="tx3">{detail}</span>}
    </div>
  );
}
