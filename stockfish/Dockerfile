FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-slim
# Установка нативного бинарника Stockfish (как в v1.0.2)
RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY server.js .

# Копируем бинарник Stockfish в /app/ (на Debian: /usr/games/stockfish)
RUN cp /usr/games/stockfish /app/stockfish && chmod +x /app/stockfish

EXPOSE 3020
CMD ["node", "server.js"]
