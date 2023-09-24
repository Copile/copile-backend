// index.js

// Import dependencies
const express = require("express");

// Import middleware and routes
const middleware = require("./middleware/middleware.js");
const tradeRoutes = require("./routes/tradeRoutes");
const orderRoutes = require("./routes/orderRoutes");
const balanceRoutes = require("./routes/balanceRoutes");

// Initialize the app and add middleware
const app = express();
middleware(app);

// Apply routes
app.use(tradeRoutes, orderRoutes, balanceRoutes);

// Export the app
exports.trades = app;