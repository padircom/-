import React from "react";
import { logAudit } from "../services/auditLogger";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || "Unknown runtime error" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logAudit("RUNTIME_ERROR", "Application", `${error.message}\n${info.componentStack ?? ""}`, "critical");
  }

  private recover = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center p-6" dir="rtl">
        <section className="glass w-full max-w-lg rounded-3xl p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-rose-400/50 bg-rose-400/10 text-[22px]">!</div>
          <h1 className="mt-4 text-[16px] font-semibold tx1">خطای موقت در اجرای صفحه</h1>
          <p className="mt-2 text-[10.5px] leading-6 tx3">برنامه متوقف نشده است. می‌توانید صفحه فعلی را بازیابی کنید یا برای ادامه، صفحه را دوباره بارگذاری کنید.</p>
          <pre className="mt-3 max-h-24 overflow-auto rounded-xl bg-black/20 p-2 text-left text-[9px] text-rose-300" dir="ltr">{this.state.message}</pre>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={this.recover} className="rounded-lg border border-sky-400/50 bg-sky-400/10 px-3 py-2 text-[10px] text-sky-200">بازیابی صفحه</button>
            <button onClick={() => window.location.reload()} className="rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-[10px] text-emerald-300">بارگذاری مجدد</button>
          </div>
        </section>
      </main>
    );
  }
}