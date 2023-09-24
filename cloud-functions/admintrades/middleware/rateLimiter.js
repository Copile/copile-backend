// rateLimiter.js

const rateLimit = require('express-rate-limit');

// Rate limit parameters
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;
const NO_TRADER = 'no_trader';

const limiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  message: 'Too many requests, please try again later.',
  keyGenerator: (req) => req.get('traderId') || NO_TRADER,
});

module.exports = limiter;
