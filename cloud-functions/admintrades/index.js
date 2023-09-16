const express = require("express");

const middleware = require("./middleware/middleware");

const tradesRoutes = require("./routes/tradeRoutes");
const orderRoutes = require("./routes/orderRoutes");
const balanceRoutes = require("./routes/balanceRoutes");

const app = express();
middleware(app);

// Apply routes
tradesRoutes(app);
orderRoutes(app);
balanceRoutes(app);

exports.callback = app;