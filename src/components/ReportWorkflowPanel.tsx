import { useEffect, useMemo, useState } from "react";
import { useAuth, roleLabel } from "../context/AuthContext";
import { pmisApiClient } from "../services/pmisApiClient";
import { type ReportWorkflowDto, type ReportWorkflowStatus } from "../services/pmisContract";
import { type Lang } from "../data/framework";

const statusMeta: Record<ReportWorkflowStatus, { fa: string; en: string; color: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft", color: "#94A3B8" },
  submitted: { fa: "ارسال‌شده", en: "Submitted", color: "#7FB2FF" },
  consultant_review: { fa: "بررسی مشاور", en: "Consultant Review", color: "#C9A7FF" },
  client_review: { fa: "بررسی کارفرما", en: "Client Review", color: "#FBBF24" },
  approved: { fa: "تایید نهایی", en: "Approved", color: "#34D399" },
  rejected: { fa: "ردشده", en: "Rejected", color: "#F87171" },
  revision_required: { fa: "نیازمند اصلاح", en: "Revision Required", color: "#FB923C" },
};

const actionMeta: Record<string, { fa: string; en: string; color: string }> = {
  submit: { fa: "ارسال برای مشاور", en: "Submit to Consultant", color: "#7FB2FF" },
  start_consultant_review: { fa: "شروع بررسی", en: "Start Review", color: "#C9A7FF" },
  consultant_accept: { fa: "ارسال برای کارفرما", en: "Forward to Client", color: "#FBBF24" },
  request_revision: { fa: "برگشت جهت اصلاح", en: "Request Revision", color: "#FB923C" },
  approve: { fa: "تایید نهایی", en: "Final Approval", color: "#34D399" },
  reject: { fa: "رد گزارش", en: "Reject Report", color: "#F87171" },
};

const availableActions = (status: ReportWorkflowStatus, role?: string) => {
  if (!role) return [];
  if (["admin", "project_manager", "site_engineer", "planner"].includes(role) && ["draft", "revision_required", "rejected"].includes(status)) return ["submit"];
  if (["admin", "consultant"].includes(role) && status === "submitted") return ["start_consultant_review", "consultant_accept", "request_revision", "reject"];
  if (["admin", "consultant"].includes(role) && status === "consultant_review") return ["consultant_accept", "request_revision", "reject"];
  if (["admin", "client"].includes(role) && status === "client_review") return ["approve", "request_revision", "reject"];
  return [];
};

export default function ReportWorkflowPanel({ lang, reportId, reportNo }: { lang: Lang; reportId: string; reportNo: string }) {
  const rtl = lang === "fa";
  const { user, audit } = useAuth();
  const [workflow, setWorkflow] = useState<ReportWorkflowDto | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true); setError(null);
    try {
      setWorkflow(await pmisApiClient.getReportWorkflow(reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, [reportId]);
  const actions = useMemo(() => availableActions(workflow?.currentStatus ?? "draft", user?.role), [workflow?.currentStatus, user?.role]);

  const apply = async (actionCode: string) => {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const next = await pmisApiClient.applyReportWorkflowAction(reportId, { actionCode, actorRole: user.role, comment: comment.trim() || undefined });
      setWorkflow(next);
      setComment("");
      audit("REPORT_WORKFLOW_ACTION", { entity: "Daily_Report", entityId: reportId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const status = workflow?.currentStatus ?? "draft";
  const statusInfo = statusMeta[status];

  return (
    <section className="glass-dark shrink-0 rounded-2xl p-3" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-2 border-b b-line-soft pb-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-[14px]">✓</span>
        <div>
          <h3 className="text-[11.5px] font-medium tx1">{rtl ? "گردش بررسی و تایید گزارش" : "Report Review & Approval Workflow"}</h3>
          <p className="text-[8.5px] font-extralight tx3" dir="ltr">Report {reportNo} · ID {reportId}</p>
        </div>
        <span className="ms-auto rounded-lg px-2.5 py-1 text-[9.5px] font-medium" style={{ background: `${statusInfo.color}18`, border: `1px solid ${statusInfo.color}55`, color: statusInfo.color }}>
          {statusInfo[lang]}
        </span>
        {user && <span className="rounded-lg border b-line-soft px-2 py-1 text-[8.5px] tx3">{user.displayName} · {roleLabel(user.role, lang)}</span>}
        <button onClick={() => void load()} disabled={busy} className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2 disabled:opacity-40">↻</button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={rtl ? "توضیح بررسی، دلیل برگشت یا نظر تایید…" : "Review comment, revision reason, or approval note…"} className="h-16 w-full resize-none rounded-xl border b-line-soft bg-black/15 px-3 py-2 text-[9.5px] tx1 outline-none focus:border-sky-400" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actions.length ? actions.map((actionCode) => {
              const meta = actionMeta[actionCode];
              return <button key={actionCode} onClick={() => void apply(actionCode)} disabled={busy} className="rounded-lg border px-2.5 py-1.5 text-[9px] font-light disabled:opacity-40" style={{ borderColor: `${meta.color}55`, background: `${meta.color}12`, color: meta.color }}>{meta[lang]}</button>;
            }) : <span className="text-[8.5px] font-extralight tx4">{rtl ? "برای نقش و وضعیت فعلی اقدامی در دسترس نیست." : "No actions are available for the current role/status."}</span>}
          </div>
          {workflow?.currentAssigneeRole && <div className="mt-2 text-[8.5px] tx3">{rtl ? "مسئول مرحله جاری:" : "Current assignee:"} <span dir="ltr">{workflow.currentAssigneeRole}</span></div>}
        </div>

        <div className="thin-scroll max-h-40 space-y-1.5 overflow-y-auto rounded-xl border b-line-soft bg-black/10 p-2">
          {!workflow?.actions.length ? <div className="grid h-20 place-items-center text-[8.5px] tx4">{busy ? (rtl ? "در حال خواندن…" : "Loading…") : (rtl ? "هنوز اقدامی ثبت نشده است." : "No workflow actions yet.")}</div> : workflow.actions.map((action) => {
            const meta = actionMeta[action.actionCode] ?? { fa: action.actionCode, en: action.actionCode, color: "#94A3B8" };
            return <div key={action.id} className="glass-row rounded-lg px-2.5 py-1.5"><div className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} /><span className="text-[9px] font-light tx1">{meta[lang]}</span><span className="tx4">·</span><span className="text-[8px] tx3" dir="ltr">{action.actorRole}</span><span className="ms-auto text-[7.5px] tx4" dir="ltr">{action.createdAt}</span></div>{action.comment && <div className="mt-1 text-[8.5px] leading-4 tx3">{action.comment}</div>}</div>;
          })}
        </div>
      </div>
      {error && <div className="mt-2 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-[8.5px] text-rose-300">✕ {error}</div>}
    </section>
  );
}