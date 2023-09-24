// middleware.js

// Import required modules
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

// Custom middleware imports
const logger = require("./logger");
const limiter = require("./rateLimiter");
const errorHandler = require("./errorHandler");

// Function to apply middleware to the express app
const middleware = (app) => {
  // Secure headers
  app.use(helmet());

  // Enable CORS
  app.use(cors());

  // JSON parser middleware
  app.use(express.json());

  // URL-encoded parser middleware
  app.use(express.urlencoded({ extended: true }));

  // Attach the logger to the request object
  app.use((req, res, next) => {
    req.logger = logger;
    next();
  });

  // Rate limiting middleware
  app.use(limiter);

  // Compression middleware
  app.use(compression());

  // Error handling middleware
  app.use(errorHandler);

  return app;
};

// Export the middleware function
module.exports = middleware;
