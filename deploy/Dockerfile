# ==========================================================
# صورة تشغيل نظام الموارد البشرية على سيرفر محلي (Node.js)
# ==========================================================
FROM node:22-bookworm-slim AS build
WORKDIR /app

# متغيرات البناء (تُحقن داخل حزمة المتصفح وقت البناء)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID=local
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    SUPABASE_URL=$VITE_SUPABASE_URL \
    SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    NITRO_PRESET=node_server

COPY package.json bun.lock* package-lock.json* pnpm-lock.yaml* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ---------------- مرحلة التشغيل ----------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
