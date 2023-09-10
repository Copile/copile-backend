class ApiError extends Error {
    constructor(status, message, source) {
      super(message);
      this.status = status;
      this.source = source; // 'telegram' or 'discord'
    }
  }
  
  module.exports = { ApiError };
  