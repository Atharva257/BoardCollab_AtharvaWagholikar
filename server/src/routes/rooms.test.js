
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/Session', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../models/Element', () => ({
  find: jest.fn(),
}));

const Session = require('../models/Session');
const Element = require('../models/Element');
const { createApp } = require('../app');
const env = require('../config/env');

const app = createApp();

const userId = '507f1f77bcf86cd799439011';
const token = jwt.sign(
  { sub: userId, username: 'atharva' },
  env.jwtSecret,
  { expiresIn: '1h' }
);

const auth = { Authorization: `Bearer ${token}` };

function makeSession(overrides = {}) {
  return {
    roomId: 'room123',
    name: 'Test Room',
    visibility: 'public',
    owner: userId,
    users: [{ userId }],
    lamport: 0,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Room routes', () => {
  test('creates a public room', async () => {
    Session.create.mockResolvedValue(
      makeSession()
    );

    const response = await request(app)
      .post('/api/rooms')
      .set(auth)
      .send({ name: 'Test Room', visibility: 'public' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      roomId: 'room123',
      name: 'Test Room',
      visibility: 'public',
    });
    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Room',
        visibility: 'public',
        owner: userId,
      })
    );
  });

  test('creates a private room with a join code', async () => {
    Session.create.mockImplementation(async (data) => ({
      ...data,
      roomId: 'private123',
    }));

    const response = await request(app)
      .post('/api/rooms')
      .set(auth)
      .send({ name: 'Private Room', visibility: 'private' });

    expect(response.status).toBe(201);
    expect(response.body.visibility).toBe('private');
    expect(response.body.joinCode).toBeTruthy();
    expect(response.body.joinCode).toHaveLength(8);
  });

  test('rejects invalid room creation data', async () => {
    const response = await request(app)
      .post('/api/rooms')
      .set(auth)
      .send({ name: '', visibility: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(Session.create).not.toHaveBeenCalled();
  });

  test('returns 404 when joining a nonexistent room', async () => {
    Session.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const response = await request(app)
      .post('/api/rooms/missing/join')
      .set(auth)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Room not found');
  });

  test('rejects an incorrect private room join code', async () => {
    const session = makeSession({
      visibility: 'private',
      owner: 'another-user',
      users: [],
      joinCode: 'correct12',
    });

    Session.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(session),
    });

    const response = await request(app)
      .post('/api/rooms/private123/join')
      .set(auth)
      .send({ joinCode: 'wrongcode' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Invalid join code');
  });

  test('allows joining a private room with the correct code', async () => {
    const session = makeSession({
      visibility: 'private',
      owner: 'another-user',
      users: [],
      joinCode: 'correct12',
    });

    Session.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(session),
    });

    const response = await request(app)
      .post('/api/rooms/private123/join')
      .set(auth)
      .send({ joinCode: 'correct12' });

    expect(response.status).toBe(200);
    expect(session.users).toContainEqual({ userId });
    expect(session.save).toHaveBeenCalled();
  });

  test('returns 404 when retrieving a nonexistent room', async () => {
    Session.findOne.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/rooms/missing')
      .set(auth);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Room not found');
  });

  test('prevents non-members from accessing a private room', async () => {
    Session.findOne.mockResolvedValue(
      makeSession({
        visibility: 'private',
        owner: 'another-user',
        users: [],
      })
    );

    const response = await request(app)
      .get('/api/rooms/private123')
      .set(auth);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Private room');
    expect(Element.find).not.toHaveBeenCalled();
  });

  test('returns room details and elements to an authorized user', async () => {
    const session = makeSession();
    const elements = [
      { elementId: 'element1', type: 'rect' },
      { elementId: 'element2', type: 'circle' },
    ];

    Session.findOne.mockResolvedValue(session);
    Element.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(elements),
    });

    const response = await request(app)
      .get('/api/rooms/room123')
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      roomId: 'room123',
      name: 'Test Room',
      visibility: 'public',
      lamport: 0,
      elements,
    });
  });
});