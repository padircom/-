import { useState } from "react";
import { roleLabel, useAuth } from "../context/AuthContext";
import { type Lang } from "../data/framework";

export default function AuthStatus({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { user, users, loginAs, logout, permissions } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" dir={rtl ? "rtl" : "ltr"}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="toggle-shell flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[10px] font-light tx1"
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-400/15 text-[12px]">👤</span>
        <span className="hidden max-w-[120px] truncate lg:inline">{user ? user.displayName : rtl ? "ورود" : "Login"}</span>
        {user && <span className="hidden rounded bg-black/15 px-1.5 py-0.5 text-[8px] tx3 xl:inline">{roleLabel(user.role, lang)}</span>}
      </button>

      {open && (
        <div className="glass-dark fade-rise absolute top-[calc(100%+8px)] z-50 w-80 rounded-2xl p-3 shadow-2xl" style={{ insetInlineStart: 0 }}>
          <div className="mb-2 border-b b-line-soft pb-2">
            <div className="text-[11px] font-medium tx1">{rtl ? "نشست کاربری و سطح دسترسی" : "User Session & Access"}</div>
            <div className="mt-0.5 text-[8.5px] font-extralight tx3">
              {rtl ? "نمونه نمایشی RBAC؛ در فاز عملیاتی با AD/OAuth جایگزین می‌شود." : "Demo RBAC; production uses AD/OAuth."}
            </div>
          </div>

          <label className="mb-2 block">
            <span className="mb-1 block text-[8.5px] font-extralight tx3">{rtl ? "ورود نمایشی با نقش:" : "Demo login as:"}</span>
            <select
              value={user?.id ?? ""}
              onChange={(e) => loginAs(e.target.value)}
              className="w-full rounded-lg border b-line-soft bg-[var(--row)] px-2.5 py-1.5 text-[10px] tx1 outline-none"
              style={{ colorScheme: "dark" }}
            >
              {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} · {roleLabel(u.role, lang)}</option>)}
            </select>
          </label>

          {user && (
            <div className="rounded-xl border b-line-soft bg-black/10 p-2">
              <div className="text-[10px] font-light tx1">{user.displayName}</div>
              <div className="mt-0.5 text-[8.5px] font-extralight tx3" dir="ltr">{user.email}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {permissions.slice(0, 8).map((p) => <span key={p} className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[7.5px] text-sky-200" dir="ltr">{p}</span>)}
                {permissions.length > 8 && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[7.5px] tx3">+{permissions.length - 8}</span>}
              </div>
            </div>
          )}

          <button onClick={logout} className="mt-2 w-full rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-[10px] text-rose-300">
            {rtl ? "خروج از نشست" : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
}