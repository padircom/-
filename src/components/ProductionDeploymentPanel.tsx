import { useMemo, useState } from "react";
import { type Lang } from "../data/framework";

type ChecklistKey =
  | "schema"
  | "env"
  | "api"
  | "frontend"
  | "rbac"
  | "storage"
  | "backup"
  | "integrations"
  | "ai"
  | "monitoring";

const dockerComposeText = `docker compose up -d --build`;
const frontendImageText = `docker build -t pmis-frontend:latest .`;
const backendImageText = `docker build -t pmis-api:latest ./server`;

const requiredEnv = [
  "SQL_SERVER",
  "SQL_DATABASE",
  "SQL_USER",
  "SQL_PASSWORD",
  "CORS_ORIGIN",
  "FILE_STORAGE_PATH",
  "SMTP_HOST",
  "SMTP_FROM",
  "AI_API_KEY",
  "OCR_PDF_SERVICE_URL",
];

const backupStepsFa = [
  "اجرای PMIS_Core_Schema.sql در SQL Server Management Studio",
  "تنظیم server/.env بر اساس server/.env.example",
  "تعریف سرویس بکاپ SQL روزانه و پر کردن BACKUP_LAST_SUCCESS_AT",
  "تهیه نسخه پشتیبان از FILE_STORAGE_PATH و پوشه storage",
  "اجرای تست بازیابی روی محیط Stage قبل از Production",
];

const backupStepsEn = [
  "Run PMIS_Core_Schema.sql in SQL Server Management Studio",
  "Create server/.env from server/.env.example",
  "Schedule daily SQL backup and update BACKUP_LAST_SUCCESS_AT",
  "Back up FILE_STORAGE_PATH and the storage directory",
  "Run a restore drill on Stage before Production",
];

const checklistLabels: Record<ChecklistKey, { fa: string; en: string }> = {
  schema: { fa: "اسکیما SQL اجرا شد", en: "SQL schema applied" },
  env: { fa: ".env تولید تکمیل شد", en: "Production .env prepared" },
  api: { fa: "Backend API روی سرور راه‌اندازی شد", en: "Backend API deployed" },
  frontend: { fa: "Frontend پشت Reverse Proxy مستقر شد", en: "Frontend deployed behind reverse proxy" },
  rbac: { fa: "نقش‌ها و دسترسی‌ها اعتبارسنجی شدند", en: "RBAC validated" },
  storage: { fa: "مسیر فایل و مجوزهای Storage آماده است", en: "File storage path/permissions ready" },
  backup: { fa: "بکاپ و تست بازیابی انجام شد", en: "Backup and restore drill completed" },
  integrations: { fa: "یکپارچگی‌ها تست شدند", en: "Integrations tested" },
  ai: { fa: "AI Gateway و RAG تست شد", en: "AI gateway and RAG tested" },
  monitoring: { fa: "مانیتورینگ و Health Check فعال شد", en: "Monitoring and health checks enabled" },
};

export default function ProductionDeploymentPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const [checks, setChecks] = useState<Record<ChecklistKey, boolean>>({
    schema: false,
    env: false,
    api: false,
    frontend: false,
    rbac: false,
    storage: false,
    backup: false,
    integrations: false,
    ai: false,
    monitoring: false,
  });

  const completion = useMemo(() => {
    const done = Object.values(checks).filter(Boolean).length;
    return Math.round((done / Object.keys(checks).length) * 100);
  }, [checks]);

  const downloadRunbook = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      completion,
      checklist: checks,
      requiredEnv,
      commands: {
        dockerCompose: dockerComposeText,
        frontendBuild: frontendImageText,
        backendBuild: backendImageText,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PMIS_Production_Runbook_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-rise space-y-3.5" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-400/45 bg-emerald-400/12 text-[18px] font-semibold text-emerald-300">
            {completion}%
          </div>
          <div>
            <h3 className="text-[13px] font-medium tx1">{rtl ? "راهنمای استقرار Production" : "Production Deployment Runbook"}</h3>
            <p className="text-[8.5px] font-extralight tx3">{rtl ? "گام‌های عملی استقرار، بکاپ، مانیتورینگ و تحویل محیط عملیاتی" : "Operational release, backup, monitoring, and go-live checklist"}</p>
          </div>
          <button onClick={downloadRunbook} className="ms-auto rounded-lg border border-sky-400/45 bg-sky-400/10 px-3 py-1.5 text-[10px] text-sky-200">⬇ {rtl ? "خروجی Runbook" : "Export runbook"}</button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <section className="glass-dark rounded-2xl p-4">
          <h4 className="mb-3 text-[11.5px] font-medium tx1">{rtl ? "چک‌لیست استقرار" : "Deployment Checklist"}</h4>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(Object.keys(checks) as ChecklistKey[]).map((key) => (
              <label key={key} className="glass-row flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={checks[key]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 accent-emerald-400"
                />
                <span className="text-[10px] font-light tx1">{checklistLabels[key][lang]}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="glass-dark rounded-2xl p-4">
          <h4 className="mb-3 text-[11.5px] font-medium tx1">{rtl ? "متغیرهای الزامی محیط" : "Required Environment Variables"}</h4>
          <div className="grid grid-cols-1 gap-2">
            {requiredEnv.map((envKey) => (
              <div key={envKey} className="rounded-xl border b-line-soft bg-black/10 px-3 py-2 font-mono text-[10px] text-sky-200" dir="ltr">
                {envKey}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="glass-dark rounded-2xl p-4">
          <h4 className="mb-2 text-[11.5px] font-medium tx1">{rtl ? "دستورات استقرار" : "Deployment Commands"}</h4>
          <div className="space-y-2 text-[9px] font-light text-emerald-200">
            <CodeBlock title={rtl ? "ساخت Frontend" : "Build Frontend"} code={frontendImageText} />
            <CodeBlock title={rtl ? "ساخت Backend" : "Build Backend"} code={backendImageText} />
            <CodeBlock title={rtl ? "اجرای Docker Compose" : "Run Docker Compose"} code={dockerComposeText} />
          </div>
        </section>

        <section className="glass-dark rounded-2xl p-4">
          <h4 className="mb-2 text-[11.5px] font-medium tx1">{rtl ? "بکاپ و بازیابی" : "Backup & Restore"}</h4>
          <ul className="space-y-2 text-[9.5px] font-light leading-5 tx2">
            {(rtl ? backupStepsFa : backupStepsEn).map((step) => (
              <li key={step} className="glass-row rounded-xl px-3 py-2">• {step}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="glass-dark rounded-2xl p-4">
        <h4 className="mb-2 text-[11.5px] font-medium tx1">{rtl ? "یادداشت فنی نهایی" : "Final Technical Note"}</h4>
        <p className="text-[9.5px] font-light leading-6 tx3">
          {rtl
            ? "تا این لحظه Frontend، Backend، RBAC، Workflow، Notifications، File Storage، RAG و OCR همگی در سطح کد و قرارداد آماده‌اند. اجرای واقعی فقط به سه چیز وابسته است: ۱) تنظیم server/.env، ۲) اجرای اسکریپت دیتابیس در SQL Server، ۳) بالا آمدن سرویس API روی شبکه عملیاتی."
            : "At this point the frontend, backend, RBAC, workflow, notifications, file storage, RAG, and OCR are implemented at code/contract level. Real execution depends on three items only: (1) configure server/.env, (2) run the SQL schema in SQL Server, and (3) bring the API service online on the target network."}
        </p>
      </section>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/20 p-3">
      <div className="mb-1 text-[8.5px] font-extralight text-white/70">{title}</div>
      <code className="block break-all text-[10px]" dir="ltr">{code}</code>
    </div>
  );
}
