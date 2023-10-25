// index.js

// Import dependencies
const express = require("express");

// Import middleware and routes
const middleware = require("./middleware/middleware.js");
const routes = require("./routes.js");
// Initialize the app and add middleware
const app = express();
middleware(app);

// Apply routes
app.use(routes);

// Export the app
exports.validate = app;