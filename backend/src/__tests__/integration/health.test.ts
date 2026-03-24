/**
 * Integration tests — Health & Auth endpoints
 * Тестируют реальные HTTP-запросы к работающему API
 * Требуют: PostgreSQL + Redis + backend dev server на порту 3000
 */

const API = 'http://localhost:3000';
type Json = Record<string, unknown>;

describe('Health endpoint', () => {
  it('GET /health — returns ok', async () => {
    const res = await fetch(`${API}/health`);
    const data = await res.json() as Json;

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.version).toBe('7.2.0');
    expect(data.db).toBe('ok');
  });

  it('GET /health — does not expose sensitive info', async () => {
    const res = await fetch(`${API}/health`);
    const data = await res.json() as Json;

    expect(data.memory).toBeUndefined();
    expect(data.stockfish).toBeUndefined();
    expect(data.totalEmitted).toBeUndefined();
    expect(data.emissionCap).toBeUndefined();
  });
});

describe('Auth endpoints', () => {
  it('POST /api/v1/auth/login — rejects empty body', async () => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/login — rejects invalid initData', async () => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'invalid_data_here' }),
    });

    expect(res.status).toBe(401);
    const data = await res.json() as Json;
    expect(data.error).toBeDefined();
  });

  it('POST /api/v1/auth/refresh — rejects invalid token', async () => {
    const res = await fetch(`${API}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'invalid_token' }),
    });

    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/me — rejects no token', async () => {
    const res = await fetch(`${API}/api/v1/auth/me`);

    expect(res.status).toBe(401);
    const data = await res.json() as Json;
    expect(data.error).toBe('No token provided');
  });

  it('GET /api/v1/auth/me — rejects invalid token', async () => {
    const res = await fetch(`${API}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer invalid_jwt_token' },
    });

    expect(res.status).toBe(401);
    const data = await res.json() as Json;
    expect(data.error).toBe('Invalid token');
  });
});

describe('Protected endpoints — reject without auth', () => {
  const protectedEndpoints = [
    { method: 'GET', path: '/api/v1/profile/games' },
    { method: 'GET', path: '/api/v1/leaderboard' },
    { method: 'GET', path: '/api/v1/tasks' },
    { method: 'GET', path: '/api/v1/shop/items' },
    { method: 'GET', path: '/api/v1/attempts' },
    { method: 'GET', path: '/api/v1/puzzles/daily' },
  ];

  for (const ep of protectedEndpoints) {
    it(`${ep.method} ${ep.path} — returns 401`, async () => {
      const res = await fetch(`${API}${ep.path}`, { method: ep.method });
      expect(res.status).toBe(401);
    });
  }
});

describe('Rate limiting', () => {
  it('Screenshotter — rejects without secret', async () => {
    const res = await fetch(`${API}/api/v1/screenshotter/token`);
    expect(res.status).toBe(403);
  });
});

describe('404 handler', () => {
  it('Unknown route returns 404', async () => {
    const res = await fetch(`${API}/api/v1/nonexistent`);
    expect(res.status).toBe(404);
    const data = await res.json() as Json;
    expect(data.error).toBe('Not found');
  });
});
