const express = require("express");
const applyMiddleware = require("./middleware/middleware");
const routes = require('./routes');
const app = express();

// apply middleware and routes to app
applyMiddleware(app);
app.use(routes);

exports.callback = app;
