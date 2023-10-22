// errorHandler.js

// Import CustomError class
const CustomError = require("../utils/error");

// Constants for HTTP status codes
const INTERNAL_SERVER_ERROR = 500;

module.exports = (err, req, res, next) => {
  // Handle custom errors
  if (err instanceof CustomError) {
    const errorMessage = `Error occurred. Source: ${err.source}, Status: ${err.status}, Message: ${err.message}`;

    // Log the error using Winston
    req.logger.error(errorMessage);

    return res
      .status(err.status)
      .json({ message: err.message, source: err.source });
  }

  // Fallback for unhandled errors
  const fallbackMessage = `Error occurred: ${err.message}`;

  // Log the unhandled error using Winston
  req.logger.error(`${fallbackMessage}, Details: ${JSON.stringify(err)}`);

  return res
    .status(INTERNAL_SERVER_ERROR)
    .json({ message: "Internal Server Error" });
};
