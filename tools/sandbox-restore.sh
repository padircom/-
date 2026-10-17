#!/usr/bin/env bash
# بازیابی محیط پس از ری‌استارت sandbox:
# ۱) همگام‌سازی git با origin  ۲) npm ci  ۳) بازتولید همهٔ فایل‌های Logic تولیدی (gitignored)
# اجرا: bash tools/sandbox-restore.sh
set -e
cd "$(dirname "$0")/.."
echo "── git sync"
git fetch origin arena/a94888dd-repo --quiet
git reset --hard origin/arena/a94888dd-repo --quiet 2>/dev/null || git reset origin/arena/a94888dd-repo --quiet
git log --oneline -1
if [ ! -x node_modules/.bin/esbuild ]; then
  echo "── npm ci"
  npm ci --silent
fi
echo "── rebuild logic bundles"
for s in sql rbac schedrecon schedrecondoc aiassist ckm ckmws cmms cmmsai cntipc cpmws dprt fin finws hrm itg itgout mcsdrill mfgplan pex pexdata pmows qms rpt rptbuilder monitoring rccws delay claimdoc sxws cntrisk cntclause cntriskdoc claimloss lossdoc lossassist; do
  npm run build:$s --silent >/dev/null 2>&1 || echo "  !! build:$s failed (احتمالاً اسکریپت وجود ندارد یا وابستگی — بررسی)"
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
