const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const logger = require("./logger");
const limiter = require("./rateLimiter");
const errorHandler = require("./errorHandler");

const middleware = (app) => {
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    req.logger = logger;
    next();
  });
  app.use(limiter);
  app.use(compression());
  // app.use(errorHandler);
  return app;
};

module.exports = middleware;
