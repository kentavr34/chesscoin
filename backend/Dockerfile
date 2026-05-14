FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Production image ─────────────────────
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY tsconfig.json ./

EXPOSE 3000

# Запуск: сначала применяем все pending Prisma-миграции (идемпотентно — все наши
# миграции с ADD VALUE / IF NOT EXISTS / DO-EXCEPTION duplicate_object). Если
# база уже актуальна — `migrate deploy` молча выйдет. Это делает старт
# reset-safe: hard reboot / новый контейнер не оставит схему отстающей от кода.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
