const express = require('express');
const bodyParser = require('body-parser');
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

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// This function will apply the middleware to an Express app
const applyMiddleware = (app) => {
  app.use(helmet());
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(limiter);
  app.use(compression());

  return app;
};

module.exports = applyMiddleware;
