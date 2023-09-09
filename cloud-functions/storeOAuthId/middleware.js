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

const errorHandler = (err, req, res) => {

  if (err instanceof AppError) {
    // if its status code 200, then dont treat it as an error
    if (err.status === 200) {
      return res.status(200).send(err.message);
    }
    req.logger.error(err.message); // Log the error using Winston
    return res.status(err.status).send(err.message);
  } else {
    req.logger.error(err); // Log the error using Winston
    return res.status(500).send("Internal Server Error");
  }
};

// This function will apply the middleware to an Express app
const applyMiddleware = (app) => {
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Attach logger to request object
  app.use((req, next) => {
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
