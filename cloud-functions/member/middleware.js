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
    // Use the user ID

    // This will not work for all requests from the frontend's middleware. The frontend's middleware puts the userId in the Auth headers.
    // The /verify endpoint gets the id from the Auth headers - meaning the first request of every frontend request is a /verify request, 
    // which first runs through this middleware, for this request; the middleware doesnt know the userId.
    const u_id = req.get("x-forwarded-authorization").split(" ")[1] || 'no_user'; // Adjust this to match the header field containing user ID

    console.log("userId in middleware", u_id)
    return u_id;
  }
});

module.exports = applyMiddleware;
