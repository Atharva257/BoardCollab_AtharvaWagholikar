
const { notFound, errorHandler } = require('./error');
const { ZodError, z } = require('zod');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('Error middleware', () => {
  test('notFound returns a JSON 404', () => {
    const req = {};
    const res = createResponse();

    notFound(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('handles duplicate MongoDB records', () => {
    const res = createResponse();

    errorHandler({ code: 11000 }, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Already exists' });
  });

  test('handles generic server errors without exposing details', () => {
    const res = createResponse();

    errorHandler(new Error('Database connection secret'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal server error',
    });
  });

  test('handles errors with an explicit HTTP status', () => {
    const res = createResponse();

    errorHandler({ status: 403, message: 'Forbidden' }, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  test('handles Zod validation errors', () => {
    const schema = z.object({
      email: z.string().email(),
    });

    let error;

    try {
      schema.parse({ email: 'invalid' });
    } catch (err) {
      error = err;
    }

    const res = createResponse();

    errorHandler(error, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        details: expect.any(Object),
      })
    );
  });
});