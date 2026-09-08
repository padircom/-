#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

mapfile -t VICTIMS < <(
  {
    git ls-files | grep -E '^[0-9a-f]{2}/[0-9a-f]{38}$'
    git ls-files | grep -E '^db/[0-9a-f]{38}$'
    git ls-files | grep -E '^hooks/.*\.sample$'
    git ls-files | grep -E '^(info/exclude|logs/HEAD|logs/refs/.*|refs/heads/.*)$'
    git ls-files | grep -E '^(HEAD|index|packed-refs|ORIG_HEAD|FETCH_HEAD)$'
  } | sort -u
)

echo "فایل‌های نامزد حذف: ${#VICTIMS[@]}"
echo "حفظ می‌شوند: $(git ls-files 'db/postgres/migrations/*.sql' | wc -l) فایل مهاجرت واقعی"

if [[ $DRY -eq 1 ]]; then
  printf '%s\n' "${VICTIMS[@]}" | head -20
  exit 0
fi

printf '%s\0' "${VICTIMS[@]}" | xargs -0 git rm -q --cached --
printf '%s\0' "${VICTIMS[@]}" | xargs -0 rm -f --
find . -mindepth 1 -maxdepth 2 -type d -empty \
  -not -path './.git*' -not -path './node_modules*' -delete 2>/dev/null || true

echo "انجام شد. فایل‌های ردیابی‌شدهٔ باقی‌مانده: $(git ls-files | wc -l)"
