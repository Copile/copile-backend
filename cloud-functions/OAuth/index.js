const express = require("express");
const applyMiddleware = require("./middleware/middleware");
const routes = require('./routes');
const app = express();

applyMiddleware(app);
app.use(routes);

exports.callback = app;
