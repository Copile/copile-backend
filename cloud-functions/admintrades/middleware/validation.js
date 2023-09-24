const CustomError = require("../utils/error");

function validateTrader(req, res, next) {
  const traderId = req.get("traderId");
  if (!traderId) {
    const err = new CustomError({
      message: "Trader ID is missing",
      status: 400,
      source: "validateTrader",
    });
    return next(err);
  }
  next();
}

module.exports = validateTrader;
