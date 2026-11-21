const express = require('express');

/**
 * Express 4 does not forward rejected async handlers to its error middleware.
 * This router adapts route callbacks while preserving middleware order.
 */
function createAsyncRouter() {
  const router = express.Router();
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const register = router[method].bind(router);
    router[method] = (path, ...handlers) => register(path, ...handlers.map((handler) => {
      if (typeof handler !== 'function' || handler.length >= 4) return handler;
      return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
    }));
  }
  return router;
}

module.exports = createAsyncRouter;
