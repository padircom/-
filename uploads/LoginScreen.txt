import { useState } from "react";
import { type Lang } from "../data/framework";
import type { UserRole } from "../context/SystemContext";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ lang, onLang }: { lang: Lang; onLang: (lang: Lang) => void }) {
  const rtl = lang === "fa";
  const { login } = useAuth();
  const [name, setName] = useState("محمدرضا هاشمی‌پور");
  const [password, setPassword] = useState("demo");
  const [role, setRole] = useState<UserRole>("project_manager");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await login(name, password, role);
    if (!res.ok) setError(res.error ?? (rtl ? "ورود ناموفق بود" : "Login failed"));
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen place-items-center p-6" dir={rtl ? "rtl" : "ltr"}>
      <div className="glass w-full max-w-[520px] rounded-3xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-sky-400/40 bg-sky-400/15 text-[22px]">◈</span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold tx1">
              {rtl ? "ورود به پلتفرم مدیریت پروژه" : "Project Management Platform Login"}
            </h1>
            <p className="mt-1 text-[10px] font-extralight tx3">
              {rtl ? "احراز هویت نمایشی JWT + کنترل نقش سازمانی" : "Demo JWT authentication + role-based access"}
            </p>
          </div>
          <div className="ms-auto flex rounded-xl border b-line-soft bg-black/10 p-[3px]" dir="ltr">
            <button onClick={() => onLang("fa")} className={`rounded-lg px-3 py-1 text-[10px] ${lang === "fa" ? "toggle-on tx1" : "tx3"}`}>FA</button>
            <button onClick={() => onLang("en")} className={`rounded-lg px-3 py-1 text-[10px] ${lang === "en" ? "toggle-on tx1" : "tx3"}`}>EN</button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-extralight tx3">{rtl ? "نام کاربری" : "Username"}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border b-line-soft bg-black/15 px-3 py-2 text-[12px] tx1 outline-none focus:border-sky-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-extralight tx3">{rtl ? "رمز عبور" : "Password"}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" className="w-full rounded-xl border b-line-soft bg-black/15 px-3 py-2 text-[12px] tx1 outline-none focus:border-sky-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-extralight tx3">{rtl ? "نقش سازمانی" : "Organization Role"}</span>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full rounded-xl border b-line-soft bg-black/15 px-3 py-2 text-[12px] tx1 outline-none focus:border-sky-400" style={{ colorScheme: "dark" }}>
              <option value="project_manager">{rtl ? "مدیر پروژه / PMO" : "Project Manager / PMO"}</option>
              <option value="site_engineer">{rtl ? "سرپرست کارگاه / مهندس اجرا" : "Site Engineer"}</option>
              <option value="consultant">{rtl ? "مشاور / ناظر مقیم" : "Consultant / Supervisor"}</option>
              <option value="employer">{rtl ? "کارفرما / مدیرعامل" : "Employer / CEO"}</option>
            </select>
          </label>
        </div>

        {error && <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-300">{error}</div>}

        <button onClick={submit} disabled={busy} className="mt-5 w-full rounded-xl border border-emerald-400/50 bg-emerald-400/15 px-4 py-2.5 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-50">
          {busy ? (rtl ? "در حال ورود…" : "Signing in…") : (rtl ? "ورود امن" : "Secure Sign In")}
        </button>

        <p className="mt-3 text-center text-[9px] font-extralight tx4">
          {rtl ? "دمو: هر رمز عبور با حداقل ۳ کاراکتر پذیرفته می‌شود. در نسخه عملیاتی، این بخش به JWT بک‌اند وصل می‌شود." : "Demo: any password with 3+ chars works. Production should validate through backend JWT."}
        </p>
      </div>
    </div>
  );
}