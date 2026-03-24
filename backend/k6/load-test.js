/**
 * k6 Load Test — ChessCoin API
 *
 * Запуск: k6 run backend/k6/load-test.js
 *
 * Сценарии:
 * 1. Health check — baseline latency
 * 2. Auth rejection — rate limiting
 * 3. Protected endpoints — 401 handling under load
 *
 * Целевые метрики:
 * - p95 < 200ms для health
 * - p95 < 500ms для API
 * - Ошибок < 1%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.API_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    health_check: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
      exec: 'healthCheck',
    },
    auth_rejection: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },
        { duration: '20s', target: 100 },
        { duration: '10s', target: 0 },
      ],
      exec: 'authRejection',
      startTime: '35s',
    },
    api_load: {
      executor: 'constant-vus',
      vus: 30,
      duration: '30s',
      exec: 'apiLoad',
      startTime: '80s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:health_check}': ['p(95)<200'],
    'http_req_duration{scenario:auth_rejection}': ['p(95)<500'],
    'http_req_failed': ['rate<0.05'],
  },
};

export function healthCheck() {
  const res = http.get(`${BASE}/health`);
  check(res, {
    'health status 200': (r) => r.status === 200,
    'health body ok': (r) => JSON.parse(r.body).status === 'ok',
    'db ok': (r) => JSON.parse(r.body).db === 'ok',
  });
  sleep(0.1);
}

export function authRejection() {
  const res = http.get(`${BASE}/api/v1/auth/me`);
  check(res, {
    'auth me returns 401': (r) => r.status === 401,
  });

  const loginRes = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ initData: 'invalid' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(loginRes, {
    'invalid login returns 401': (r) => r.status === 401,
  });
  sleep(0.2);
}

export function apiLoad() {
  const endpoints = [
    '/health',
    '/api/v1/auth/me',
    '/api/v1/shop/items',
    '/api/v1/tasks',
    '/api/v1/leaderboard',
  ];

  const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE}${ep}`);
  check(res, {
    'response received': (r) => r.status === 200 || r.status === 401,
    'not 500': (r) => r.status !== 500,
  });
  sleep(0.1);
}
