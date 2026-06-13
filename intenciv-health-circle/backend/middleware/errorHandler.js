/**
 * Centralised error handler. Logs the stack and returns a generic JSON
 * shape. Validation errors thrown by express-validator are normalised
 * by the route layer.
 */
function notFound(_req, res, _next) {
  res.status(404).json({ error: 'not_found' });
}

function errorHandler(err, _req, res, _next) {
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.code || 'internal_error',
    message: err.publicMessage || (status === 500 ? 'Something went wrong' : err.message),
  });
}

module.exports = { notFound, errorHandler };
