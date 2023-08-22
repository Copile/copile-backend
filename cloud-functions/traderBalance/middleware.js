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
  return app;
};

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 50, // 50 requests per minute
  keyGenerator: (req) => {
    // Use the trader ID
    const traderId = req.get("traderId") || 'no_trader'; // extract traderId
    return traderId;
  }
});

module.exports = applyMiddleware;
