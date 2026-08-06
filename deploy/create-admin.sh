#!/usr/bin/env bash
# إنشاء حساب المدير التنفيذي الأول بعد تشغيل النظام محلياً
# الاستخدام: ./create-admin.sh admin@yateemdev.org "كلمة المرور"
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a

EMAIL="${1:?الرجاء تمرير البريد الإلكتروني}"
PASSWORD="${2:?الرجاء تمرير كلمة المرور}"

RESP=$(curl -s -X POST "${PUBLIC_HOST}:${GATEWAY_PORT}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true}")

USER_ID=$(printf '%s' "$RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
if [ -z "$USER_ID" ]; then echo "فشل الإنشاء: $RESP"; exit 1; fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d "${POSTGRES_DB}" \
  -c "insert into public.user_roles (user_id, role) values ('${USER_ID}', 'executive_director') on conflict do nothing;"

echo "تم إنشاء حساب المدير التنفيذي: ${EMAIL}"
