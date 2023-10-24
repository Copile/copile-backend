const CustomError = require("../utils/error");

function validateEntity(req, res, next) {
  const entityId = req.get("traderId") || req.get("userId");
  if (!entityId) {
    const err = new CustomError({
      message: "Entity ID is missing",
      status: 400,
      source: "validateEntity",
    });
    return next(err);
  }
  next();
}

module.exports = validateEntity;
