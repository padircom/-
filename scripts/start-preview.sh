#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# بالا آوردن کامل محیط پیش‌نمایش با یک دستور
#
#   bash scripts/start-preview.sh
#
# ۱. نصب وابستگی‌ها (اگر node_modules نباشد)
# ۲. بازتولید باندل‌های server/*Logic.js (در Git ignore شده‌اند)
# ۳. اجرای API روی :4000 و وب روی :5173
# ۴. نظارت: اگر هر کدام بایستند، خودکار دوباره بالا می‌آیند
#
# محیط ابری گاهی بین نشست‌ها ریست می‌شود؛ بعد از هر ریست همین اسکریپت
# کافی است. خروجی: وب http://localhost:5173 و API http://localhost:4000
# ─────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.."

echo "▶ ریشه: $(pwd)"

if [ ! -d node_modules ]; then
  echo "▶ نصب وابستگی‌ها (npm ci)…"
  npm ci
else
  echo "✔ node_modules موجود است"
fi

echo "▶ بازتولید باندل‌های سرور…"
BUILDS=$(node -e "console.log(Object.keys(require('./package.json').scripts).filter(s=>/^build:/.test(s)&&s!=='build:all').join(' '))")
for s in $BUILDS; do
  npm run --silent "$s" >/dev/null 2>&1 || echo "  ⚠ خطا در $s"
done
echo "✔ $(ls server/*Logic.js 2>/dev/null | wc -l) باندل آماده است"

echo "▶ API روی :4000"
( while true; do node server/index.js; echo "  ↺ API متوقف شد؛ راه‌اندازی دوباره…"; sleep 3; done ) &

echo "▶ وب روی :5173"
( while true; do npx vite --host 0.0.0.0 --port 5173 --strictPort; echo "  ↺ وب متوقف شد؛ راه‌اندازی دوباره…"; sleep 3; done ) &

wait
