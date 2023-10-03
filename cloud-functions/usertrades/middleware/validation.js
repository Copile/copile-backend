const CustomError = require("../utils/error");

function validateUser(req, res, next) {
  const userId = req.get("userId");
  if (!userId) {
    const err = new CustomError({
      message: "User ID is missing",
      status: 400,
      source: "validateUser",
    });
    return next(err);
  }
  next();
}

module.exports = validateUser;
