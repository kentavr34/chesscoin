# ChessCoin One-Click Startup Script (Windows PowerShell)

Write-Host "--- ChessCoin: One-Click Startup ---" -ForegroundColor Cyan

# 1. Запуск инфраструктуры (Docker)
Write-Host "1. Подготовка Docker контейнеров..." -ForegroundColor Yellow

# ОЧИСТКА: Удаляем старые контейнеры, если они блокируют запуск
docker rm -f chesscoin_postgres chesscoin_redis 2>$null

# Запуск через docker-compose
docker-compose up -d postgres redis

if ($LASTEXITCODE -ne 0) {
    Write-Host "X Docker error. Please ensure Docker Desktop is running!" -ForegroundColor Red
    pause
    exit
}
Write-Host "V Database and Redis are UP." -ForegroundColor Green

# 2. Подготовка базы данных (Prisma)
Write-Host "2. Preparing database (Prisma)..." -ForegroundColor Cyan
cd backend
npx prisma generate

# Wait for DB to be completely ready (fixes P1001)
$retries = 10
while ($retries -gt 0) {
    Write-Host "Waiting for database to accept connections... ($retries)"
    if (npx prisma migrate status 2>&1 | Select-String "Database is up to date" -Quiet) {
        break
    }
    Start-Sleep -Seconds 3
    $retries--
}

npx prisma migrate deploy
cd ..

# 3. Запуск Бэкенда (Порт 3000)
Write-Host "3. Launching Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; Write-Host '--- BACKEND SERVER ---' -ForegroundColor Magenta; npx tsx watch src/index.ts"

# 4. Запуск Фронтенда (Порт 5173)
Write-Host "4. Launching Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; Write-Host '--- FRONTEND (Vite) ---' -ForegroundColor Cyan; npm run dev"

# 5. Запуск Телеграм-бота
Write-Host "5. Launching Telegram Bot..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd bot; Write-Host '--- TELEGRAM BOT ---' -ForegroundColor Green; python main.py"

# 6. Ngrok (Bridge to Telegram)
Write-Host "--- ALL READY! ---" -ForegroundColor Green
Write-Host "If you want to play on your Phone, you need ngrok." -ForegroundColor Yellow
$ngrokPath = where.exe ngrok 2>$null
if ($ngrokPath) {
    Write-Host "Ngrok found. Start tunnel? (Y/N)" -ForegroundColor Cyan
    $choice = Read-Host
    if ($choice -eq "Y" -or $choice -eq "y") {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 5173"
    }
}

Write-Host "Backend: http://localhost:3000"
Write-Host "Frontend: http://localhost:5173"
Write-Host "DONE! Enjoy ChessCoin." -ForegroundColor Green
pause
