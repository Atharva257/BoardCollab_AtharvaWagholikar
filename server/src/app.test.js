const request = require('supertest');
const { createApp } = require('./app');

describe('HTTP API', () => {
  const app = createApp();

  test('health endpoint reports the service as ready', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test('protected room routes reject requests without a JWT', async () => {
    const response = await request(app).get('/api/rooms/demo-room');
    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/token/i);
  });

  test('unknown routes return a JSON 404', async () => {
    const response = await request(app).get('/not-a-route');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });

  test('registration validates required account fields before database access', async () => {
    const response = await request(app).post('/api/auth/register').send({ username: 'x', email: 'not-an-email', password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});
