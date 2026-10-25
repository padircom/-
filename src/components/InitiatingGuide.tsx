import { WF_COLOR, WorkflowColumnHead, WorkflowMapFrame, WorkflowNodeBox } from "./WorkflowMapKit";
import { ROLE_CATALOG, effectivePermissions } from "../services/accessControl";
import { type Lang, type Process } from "../data/framework";
import { roleLabel, rolePermissions, type RoleCode } from "../context/AuthContext";

type Props = {
  lang: Lang;
  processes: Process[];
  projectName: string;
  currentRole?: RoleCode;
  canEditStructure: boolean;
  onSelect: (processId: string, subId: string) => void;
  guide: boolean;
};

export default function InitiatingGuide({ lang, processes, projectName, currentRole, canEditStructure, onSelect, guide }: Props) {
  const fa = lang === "fa";
  const editors = ROLE_CATALOG.filter(r => rolePermissions[r.code]?.includes("gov.process.edit")).map(r => roleLabel(r.code as RoleCode, lang));
  const pmoEditors = ROLE_CATALOG.filter(r => effectivePermissions(r.code).includes("pmo.charter.edit")).map(r => roleLabel(r.code as RoleCode, lang));
  if (!guide) {
    const colors = [WF_COLOR.input, WF_COLOR.hub, WF_COLOR.cycle, WF_COLOR.output, WF_COLOR.hub];
    return (
      <div className="thin-scroll h-full min-h-0 overflow-auto p-3 md:p-4" dir={fa ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-5xl space-y-3">
          <WorkflowMapFrame
            title={fa ? "نقشهٔ فرایندی مدیریت حاکمیت پروژه" : "Project governance process map"}
            hint={fa ? "برای ورود، زیرفرایند مورد نظر را انتخاب کنید" : "Select a sub-process to open its workspace"}
          >
            <p className="mt-2 text-start text-[10px] tx2" dir={fa ? "rtl" : "ltr"}>{projectName}</p>
            {processes.length > 0 ? (
              <div className="thin-scroll mt-4 overflow-x-auto pb-2" dir={fa ? "rtl" : "ltr"}>
                <div className="flex min-w-[700px] items-stretch gap-2">
                  {processes.map((process, index) => {
                    const color = colors[index % colors.length];
                    return (
                      <div key={process.id} className="flex min-w-0 flex-1 items-stretch gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                          <WorkflowColumnHead fa={process.title.fa} en={process.title.en} rtl={fa} color={color} icon={index === 0 ? "inputs" : index === processes.length - 1 ? "outputs" : "cycle"} />
                          <div className="flex flex-1 flex-col gap-2 rounded-xl border b-line-soft bg-black/5 p-2">
                            {process.subs.map(sub => (
                              <WorkflowNodeBox
                                key={sub.id}
                                node={{ titleFa: sub.title.fa, titleEn: sub.title.en, kind: "proc" }}
                                rtl={fa}
                                accent={color}
                                onNavigate={() => onSelect(process.id, sub.id)}
                              />
                            ))}
                            {process.subs.length === 0 && <span className="py-2 text-center text-[10px] tx3">—</span>}
                          </div>
                        </div>
                        {index < processes.length - 1 && (
                          <span className="flex shrink-0 items-center tx2" aria-hidden="true">
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-4 w-4 ${fa ? "" : "rotate-180"}`}>
                              <path d="M17 10H3m5-5-5 5 5 5" />
                            </svg>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : <p className="mt-3 text-[11px] tx3" dir={fa ? "rtl" : "ltr"}>{fa ? "فرایندی برای این پروژه تعریف نشده است." : "No processes configured for this project."}</p>}
          </WorkflowMapFrame>
          <p className="text-[10px] tx3">{fa ? "این نقشه مسیر دسترسی به فرایندهاست؛ انتخاب گره‌ها اطلاعاتی را ثبت یا تغییر نمی‌دهد." : "This map provides process navigation; selecting nodes does not create or change data."}</p>
        </div>
      </div>
    );
  }
  return <div className={`thin-scroll h-full min-h-0 w-full p-3 md:p-4 ${guide ? "overflow-y-auto" : "overflow-hidden"}`} dir={fa ? "rtl" : "ltr"}>
    <div className={guide ? "mx-auto max-w-5xl space-y-5" : "mx-auto flex h-full min-h-0 max-w-5xl flex-col gap-2"}>
      <header className="shrink-0">
        <p className="text-[10px] tracking-wider text-sky-300">{fa ? "گروه آغازین · ماژول حاکمیت و فرایندهای PMBOK" : "Initiating · Governance & PMBOK"}</p>
        <h2 className="mt-1 text-lg font-semibold tx1">{guide ? (fa ? "راهنمای کار با ماژول" : "How this module works") : (fa ? "نقشهٔ کاری فرایندها" : "Process work map")}</h2>
        <p className="mt-1 text-[11px] leading-6 tx3">{projectName} · {fa ? "ساختار گام‌ها از درخت فرایند همین پروژه خوانده می‌شود؛ انتخاب هر گام شما را به نمای مرتبط می‌برد." : "Steps reflect this project's process tree; select a step to open its workspace."}</p>
      </header>
      <>
        <div className="grid gap-3 md:grid-cols-2">
          <section className="glass-dark rounded-xl p-4">
            <h3 className="text-sm font-medium tx1">{fa ? "از کجا شروع کنم؟" : "Where do I start?"}</h3>
            <ol className="mt-2 list-inside list-decimal space-y-2 text-[11px] leading-6 tx2">
              <li>{fa ? "در نقشهٔ اصلی یا فهرست سمت راست، فرایند و سپس زیرفرایند را انتخاب کنید." : "Choose a process and sub-process on the map or in the right-hand list."}</li>
              <li>{fa ? "برای کار با پرونده‌ها، از سایدبار «دفتر مدیریت پروژه» را انتخاب کنید و بخش منشور، فرم‌ها یا سلامت پروژه را باز کنید." : "Select Project Management Office in the sidebar for charters, forms and project health records."}</li>
              <li>{fa ? "پس از ورود، فقط در صورت نمایش فرم ثبت یا دکمهٔ ویرایش و داشتن مجوز، داده وارد کنید؛ نتیجه را در همان میز کار بازبینی کنید." : "Enter data only where a form or edit control is available and you have permission; review it in the same workspace."}</li>
            </ol>
          </section>
          <section className="glass-dark rounded-xl p-4">
            <h3 className="text-sm font-medium tx1">{fa ? "نمایشی یا قابل ویرایش؟" : "View-only or editable?"}</h3>
            <p className="mt-2 text-[11px] leading-6 tx2">{fa ? "این نقشه صرفاً راهبری است و با کلیک روی گره‌ها چیزی را ثبت یا تغییر نمی‌دهد. نمای حاکمیت می‌تواند دادهٔ نمونه یا API نشان دهد؛ نشانگر «داده زنده/داده نمونه» را در همان صفحه بررسی کنید. دادهٔ نمونه را ثبت واقعی تلقی نکنید. ثبت منشور و فرم در میز کار PMO، در صورت اتصال API و مجوز، عملیاتی است." : "This map is navigation only; clicking a node never writes data. Governance may show sample or API data; check its Live/Sample indicator. PMO charter and form entries are persisted only when its API is available and you have permission."}</p>
          </section>
          <section className="glass-dark rounded-xl p-4 md:col-span-2">
            <h3 className="text-sm font-medium tx1">{fa ? "چه کسی می‌تواند تغییر دهد؟" : "Who can make changes?"}</h3>
            <p className="mt-2 text-[11px] leading-6 tx2">{fa ? "ویرایش ساختار فرایندها از دکمهٔ «ویرایش فرایندها» انجام می‌شود و به مجوز gov.process.edit، دسترسی به پروژه و تأیید سرور نیاز دارد. نقش‌های دارای این مجوز در پیکربندی فعلی:" : "Process-tree editing requires gov.process.edit, project access and server approval. Roles configured with this permission:"} <strong className="tx1">{editors.join(fa ? "، " : ", ") || (fa ? "هیچ‌کدام" : "None")}</strong>.</p>
            <p className="mt-2 text-[11px] leading-6 tx2">{fa ? "ثبت منشور PMO مجوز جداگانهٔ pmo.charter.edit می‌خواهد؛ نقش‌های دارای آن:" : "PMO charter entry requires a separate pmo.charter.edit permission, granted to:"} <strong className="tx1">{pmoEditors.join(fa ? "، " : ", ") || (fa ? "هیچ‌کدام" : "None")}</strong>. {fa ? "هر فرم و اقدام دیگر مجوز اختصاصی خود را دارد و سرور هنگام ثبت دوباره آن را بررسی می‌کند." : "Other forms and actions have separate permissions enforced again by the server."}</p>
            <p className="mt-2 text-[11px] tx3">{fa ? "نقش فعلی" : "Current role"}: {currentRole ? roleLabel(currentRole, lang) : (fa ? "وارد نشده" : "Not signed in")} · {canEditStructure ? (fa ? "ویرایش ساختار برای این پروژه مجاز است" : "Process-tree editing available for this project") : (fa ? "ویرایش ساختار برای این پروژه در دسترس نیست" : "Process-tree editing unavailable for this project")}</p>
          </section>
        </div>
      </>
    </div>
  </div>;
}
