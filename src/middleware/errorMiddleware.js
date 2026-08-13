export const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.originalUrl}`,
  });
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  // Log 500 internal server errors, but suppress noisy stack traces for standard 4xx user validation/auth errors
  if (statusCode >= 500) {
    console.error('[Server Error]', err.stack || err.message);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};
