
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const {
  signToken,
  verifyToken,
  requireAuth,
} = require('./auth');

describe('Authentication middleware', () => {
  test('signToken creates a valid JWT for a user', () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      username: 'atharva',
    };

    const token = signToken(user);
    const payload = verifyToken(token);

    expect(payload.sub).toBe(user._id);
    expect(payload.username).toBe(user.username);
  });

  test('verifyToken rejects an invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });

  test('rejects requests without authorization token', () => {
    const req = { headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects expired JWT tokens', () => {
    const token = jwt.sign(
      { sub: 'user123', username: 'test' },
      env.jwtSecret,
      { expiresIn: -1 }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid or expired token',
    });
  });

  test('accepts a valid JWT and attaches user details', () => {
    const token = jwt.sign(
      { sub: 'user123', username: 'atharva' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.user).toEqual({
      id: 'user123',
      username: 'atharva',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});