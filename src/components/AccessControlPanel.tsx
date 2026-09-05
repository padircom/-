import { roleLabel, rolePermissions, useAuth, type RoleCode } from "../context/AuthContext";
import { type Lang } from "../data/framework";

export default function AccessControlPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { users, auditEvents, clearAudit } = useAuth();
  const roles = Object.keys(rolePermissions) as RoleCode[];

  return (
    <div className="fade-rise space-y-3.5" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 border-b b-line-soft pb-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-[15px]">🛡</span>
          <div>
            <h3 className="text-[12px] font-medium tx1">{rtl ? "کاربران، نقش‌ها و دسترسی پروژه‌ای" : "Users, Roles & Project Access"}</h3>
            <p className="text-[8.5px] font-extralight tx3">{rtl ? "نمونه نمایشی RBAC؛ آماده جایگزینی با Azure AD / OAuth2" : "Demo RBAC; ready to be replaced by Azure AD / OAuth2"}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {users.map((u) => (
            <div key={u.id} className="glass-row rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/10 text-[13px]">👤</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10.5px] font-light tx1">{u.displayName}</div>
                  <div className="truncate text-[8.5px] font-extralight tx4" dir="ltr">{u.username} · {u.email}</div>
                </div>
                <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[8px] text-sky-200">{roleLabel(u.role, lang)}</span>
              </div>
              <div className="mt-2 text-[8.5px] font-extralight tx3">
                {rtl ? "پروژه‌های مجاز:" : "Allowed projects:"} <span dir="ltr">{u.projectIds.join(", ")}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-dark rounded-2xl p-4">
        <h3 className="mb-3 text-[12px] font-medium tx1">{rtl ? "ماتریس نقش و مجوز" : "Role / Permission Matrix"}</h3>
        <div className="thin-scroll max-h-[40vh] overflow-auto rounded-xl border b-line-soft">
          <table className="w-full min-w-[720px] border-collapse text-[9.5px]">
            <thead><tr className="border-b b-line-soft bg-black/25"><th className="px-2 py-2 text-start tx3">Role</th><th className="px-2 py-2 text-start tx3">Permissions</th></tr></thead>
            <tbody className="divide-y b-line-soft">
              {roles.map((role) => (
                <tr key={role}>
                  <td className="px-2 py-2 font-light tx1">{roleLabel(role, lang)}</td>
                  <td className="px-2 py-2"><div className="flex flex-wrap gap-1">{rolePermissions[role].map((p) => <span key={p} className="rounded bg-fuchsia-400/10 px-1.5 py-0.5 text-[7.5px] text-fuchsia-200" dir="ltr">{p}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-dark rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[12px] font-medium tx1">{rtl ? "لاگ ممیزی نشست" : "Session Audit Log"}</h3>
          <button onClick={clearAudit} className="ms-auto rounded-lg border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-[9px] text-rose-300">{rtl ? "پاک‌سازی" : "Clear"}</button>
        </div>
        <div className="thin-scroll max-h-[28vh] space-y-1 overflow-y-auto">
          {auditEvents.length === 0 ? <div className="py-6 text-center text-[10px] tx4">{rtl ? "رویدادی ثبت نشده" : "No events"}</div> : auditEvents.map((e) => (
            <div key={e.id} className="glass-row flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[9px]">
              <span className="tx1" dir="ltr">{e.action}</span>
              <span className="tx4">·</span>
              <span className="tx3" dir="ltr">{e.username}</span>
              <span className="ms-auto tx4" dir="ltr">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}