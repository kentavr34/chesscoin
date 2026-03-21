# ─── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Зависимости
COPY package.json ./
RUN npm install --frozen-lockfile

# Исходники
COPY . .

# Собираем
RUN npm run build

# ─── Stage 2: Serve ───────────────────────────────────────────
FROM nginx:alpine

# Убираем дефолтный конфиг
RUN rm /etc/nginx/conf.d/default.conf

# SPA конфиг — все маршруты → index.html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Gzip\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Кеширование статики\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/app.conf

# Копируем собранное приложение
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
