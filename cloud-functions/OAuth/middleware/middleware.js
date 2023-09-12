const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimiter = require('./rateLimiter');
const logger = require('./logger');
//const errorHandler = require('./errorHandler');

// for loading environment variables from .env file
require('dotenv').config();

// This function will apply the middleware to an Express app
const applyMiddleware = (app) => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(cors());

  app.use((req, res, next) => {
    req.logger = logger;
    next();
  });

  app.use(rateLimiter);
  app.use(compression());

  // Apply the error handling middleware last
  //app.use(errorHandler);
  return app;
};

module.exports = applyMiddleware;
