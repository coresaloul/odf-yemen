#!/usr/bin/env bash
# تطبيق جميع ملفات الهجرة (schema) بالترتيب على قاعدة البيانات المحلية
# الاستخدام: ./apply-migrations.sh
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a

echo "== انتظار جاهزية قاعدة البيانات =="
until docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; do sleep 2; done

for f in ../supabase/migrations/*.sql; do
  echo "-- تطبيق: $(basename "$f")"
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d "${POSTGRES_DB}" < "$f"
done

echo "== تم تطبيق جميع ملفات الهجرة بنجاح =="
