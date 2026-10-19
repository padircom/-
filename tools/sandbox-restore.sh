#!/usr/bin/env bash
# بازیابی محیط پس از ری‌استارت sandbox:
# ۱) همگام‌سازی git با origin  ۲) npm ci  ۳) بازتولید همهٔ فایل‌های Logic تولیدی (gitignored)
# اجرا: bash tools/sandbox-restore.sh
set -e
cd "$(dirname "$0")/.."
echo "── git sync"
# نکتهٔ حیاتی: reset --hard ویرایش‌های uncommitted را نابود می‌کند.
# فقط وقتی hard لازم است که working tree نسبت به origin پشت باشد؛ در غیراین صورت mixed.
git fetch origin arena/a94888dd-repo --quiet
if git diff --quiet HEAD origin/arena/a94888dd-repo -- 2>/dev/null && [ -z "$(git status --porcelain | grep -v '^??')" ]; then
  git reset --hard origin/arena/a94888dd-repo --quiet
else
  git reset origin/arena/a94888dd-repo --quiet 2>/dev/null || true
  echo "  !! working tree دارای تغییرات uncommitted است — hard reset انجام نشد"
fi
git log --oneline -1
if [ ! -x node_modules/.bin/esbuild ]; then
  echo "── npm ci"
  npm ci --silent
fi
echo "── rebuild logic bundles"
# تمام build:* scriptهای package.json را کشف و اجرا کن (b:rptbuilder و دیگر کلیدهای ممکن هم)
for s in $(node -e 'const s=require("./package.json").scripts; console.log(Object.keys(s).filter(k=>k.startsWith("build:")).map(k=>k.slice(6)).join(" "))'); do
  npm run build:$s --silent >/dev/null 2>&1 || echo "  !! build:$s failed (احتمالاً اسکریپت ناقص/وابستگی — بررسی)"
done
node -e '
const fs=require("fs"),path=require("path");
const missing=new Set();
for(const f of fs.readdirSync("server").filter(f=>f.endsWith(".js"))){
  const src=fs.readFileSync(path.join("server",f),"utf8");
  const re=/(?:from|import)\s*\(?\s*["\x27]\.\/([A-Za-z0-9_]+)\.js["\x27]/g;
  let m; while((m=re.exec(src))) if(!fs.existsSync(path.join("server",m[1]+".js"))) missing.add(m[1]);
}
if(missing.size){ console.error("MISSING: "+[...missing].join(",")); process.exit(1);}
console.log("✓ همهٔ وابستگی‌های سرور موجود — آمادهٔ استارت API و Vite");'
