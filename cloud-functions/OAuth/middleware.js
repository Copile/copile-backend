const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const { LoggingWinston } = require('@google-cloud/logging-winston');
const compression = require('compression');

// Setup Google Cloud Logger
const loggingWinston = new LoggingWinston();
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console(), loggingWinston],
});

// for loading environment variables from .env file
require('dotenv').config();

const errorHandler = (err, req, res, next) => {
  console.error(err); // Log the error for debugging

  if (err instanceof TelegramError) {
    req.logger.error(err.message); // Log the error using Winston
    // For the Telegram route, always return a 200 status code
    res.status(200).send(err.message);
  } else {
    req.logger.error(err); // Log the error using Winston
    // For other routes, return the appropriate status code
    res.status(err.status || 500).send(err.message || 'Internal Server Error');
  }
};

// This function will apply the middleware to an Express app
const applyMiddleware = (app) => {
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Attach logger to request object
  app.use((req, res, next) => {
    req.logger = logger;
    next();
  });

  app.use(limiter);
  app.use(compression());

  // Apply the error handling middleware last
  app.use(errorHandler);
  return app;
};

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => {
    // Use the user ID
    const u_id = req.get('userId') || 'no_user'; // Adjust this to match the header field containing user ID
    return u_id;
  },
});

module.exports = applyMiddleware;
