const CustomError = require("../utils/error");

function validateTrader(req, res, next) {
  const traderId = req.get("traderId");
  if (!traderId) {
    throw new CustomError({
      message: "Trader ID is missing",
      status: 400,
      source: "validateTrader",
    });
  }
  next();
}

module.exports = validateTrader;
