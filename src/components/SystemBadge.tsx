/* نشانِ کد سامانه در سربرگ صفحهٔ حوزه — مثل «EDMS · اسناد و مدارک».
 * منبع نام‌ها: `src/data/systemCatalog.ts`. سایدبار را لمس نمی‌کند. */
import { t, type Lang } from "../data/framework";
import { suiteOf, systemsForDomain } from "../data/systemCatalog";

type Props = { domainId: string; lang: Lang; className?: string };

export default function SystemBadge({ domainId, lang, className = "" }: Props) {
  const entries = systemsForDomain(domainId);
  if (entries.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {entries.map((e) => {
        const color = suiteOf(e).color;
        return (
          <span
            key={e.code}
            title={`${t(suiteOf(e).title, lang)} · ${e.name.en}`}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-light leading-none"
            style={{ background: `${color}1a`, border: `1px solid ${color}55` }}
          >
            <span dir="ltr" className="font-semibold tracking-wide" style={{ color }}>
              {e.code}
            </span>
            <span className="tx4">·</span>
            <span className="tx2">{t(e.name, lang)}</span>
          </span>
        );
      })}
    </span>
  );
}
