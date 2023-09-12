const express = require("express");
const applyMiddleware = require("./middleware/middleware");
const routes = require('./routes');
const app = express();
const errorHandler = require('./middleware/errorHandler');

// apply middleware and routes to app
applyMiddleware(app);
app.use(routes);
app.use(errorHandler);

exports.callback = app;
