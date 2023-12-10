const express = require("express");
const applyMiddleware = require("./middleware");
const routes = require("./routes");
const app = express();

applyMiddleware(app);
app.use(routes);

// expose the express app as a cloud function
module.exports = {
  salestracker: app,
};
