const express = require("express");

const middleware = require("./middleware/middleware.js");

const tradeRoutes = require("./routes/tradeRoutes");
const orderRoutes = require("./routes/orderRoutes");
const balanceRoutes = require("./routes/balanceRoutes");

const app = express();
middleware(app);

// Apply routes
app.use(tradeRoutes, orderRoutes, balanceRoutes);

exports.callback = app;