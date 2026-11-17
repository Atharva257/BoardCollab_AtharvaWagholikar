const { ZodError } = require('zod');

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten().fieldErrors });
  }
  if (err.code === 11000) return res.status(409).json({ error: 'Already exists' });
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
}

module.exports = { notFound, errorHandler };
