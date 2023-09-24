// logger.js

// Import the required modules
const winston = require('winston');
const { LoggingWinston } = require('@google-cloud/logging-winston');

// Initialize Google Cloud Winston logger
const loggingWinston = new LoggingWinston();

// Create a Winston logger with console and Google Cloud transports
const logger = winston.createLogger({
  // Logging level set to 'info' by default
  level: 'info',
  
  // Enable logging to both the console and Google Cloud
  transports: [new winston.transports.Console(), loggingWinston],
});

// Export the logger for use in other files
module.exports = logger;
