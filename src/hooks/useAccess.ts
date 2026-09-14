import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  DEMO_DELEGATIONS,
  DEMO_SUBJECTS,
  can as canEval,
  evaluate,
  maskRecord,
  type AccessContext,
  type Subject,
} from "../services/accessControl";

/**
 * پل میان AuthContext موجود و موتور RBAC.
 *
 * AuthContext دست‌نخورده می‌ماند (چند کامپوننت به شکل فعلی‌اش وابسته‌اند)؛
 * این قلاب فقط کاربر جاری را به Subject موتور ترجمه می‌کند تا هر جای برنامه
 * بتواند `can("fin.ipc.approve")` بپرسد.
 */
export function useAccess() {
  const { user } = useAuth();

  const subject = useMemo<Subject | null>(() => {
    if (!user) return null;
    // کاربر متناظر در کاتالوگ موتور؛ اگر نبود، از روی نقش AuthContext ساخته می‌شود.
    const known = DEMO_SUBJECTS.find((s) => s.id === user.id);
    if (known) return known;
    return {
      id: user.id,
      displayName: user.displayName,
      roles: [user.role],
      projectIds: user.projectIds,
      active: user.active,
    };
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);

  const withDefaults = (ctx: AccessContext = {}): AccessContext => ({
    delegations: DEMO_DELEGATIONS,
    onDate: today,
    ...ctx,
  });

  return {
    subject,
    can: (permission: string, ctx?: AccessContext) => canEval(subject, permission, withDefaults(ctx)),
    explain: (permission: string, ctx?: AccessContext) =>
      subject
        ? evaluate(subject, permission, withDefaults(ctx))
        : { allow: false, code: "DENY_INACTIVE" as const, reason: { fa: "کاربری وارد نشده است", en: "No authenticated user" }, audit: true },
    mask: <T extends Record<string, unknown>>(row: T, ctx?: AccessContext) => maskRecord(subject, row, withDefaults(ctx)),
  };
}
