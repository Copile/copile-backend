/**
 * CustomError Class
 *
 * Extends the built-in Error class to provide additional properties for HTTP status and source of error.
 */
class CustomError extends Error {
  /**
   * Creates a new CustomError instance.
   *
   * @param {Object} param0 Options for the error.
   * @param {string} param0.message Error message.
   * @param {number} [param0.status=500] HTTP status code. Defaults to 500.
   * @param {string} [param0.source='Unknown'] Source or context of the error. Defaults to 'Unknown'.
   */
  constructor({ message, status = 500, source = "Unknown" }) {
    super(message);
    this.status = status;
    this.source = source;
  }
}

module.exports = CustomError;
