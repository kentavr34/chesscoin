FROM python:3.11-alpine

WORKDIR /app

# Зависимости для сборки (для aiohttp)
RUN apk add --no-cache gcc musl-dev

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
