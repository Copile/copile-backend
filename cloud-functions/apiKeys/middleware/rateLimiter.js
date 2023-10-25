// rateLimiter.js

const rateLimit = require('express-rate-limit');

// Rate limit parameters
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;
const NO_TRADER_OR_USER = 'no_trader_or_user';

const limiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  message: 'Too many requests, please try again later.',
  keyGenerator: (req) => req.get('traderId') || req.get('userId') || NO_TRADER_OR_USER,
});

module.exports = limiter;
