const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const decryptData = require("./utils/decryption");
const createSession = require("./exchanges/sessionFactory");
const validateEntity  = require("./middleware/validation");
const CustomError = require("./utils/error");

const router = express.Router();
const db = new Firestore();

router.post("/validate/:exchange", validateEntity, async (req, res, next) => {
  const entityId = req.get("traderId") || req.get("userId");
  const exchange = req.params.exchange;

  const apiKey = req.body.api_key;
  var apiSecret = req.body.api_secret;
  var apiPassphrase = req.body.api_passphrase || null;

  if (exchange === "bybit") {
    throw new CustomError({
      message: "Bybit is not supported by this endpoint.",
      status: 400,
      source: "validateAPIKeys",
    });
  }

  try {
    apiSecret = (await decryptData(apiSecret, entityId));

    if (apiPassphrase) {
      apiPassphrase = await decryptData(keys.api_passphrase, entityId);
    }

    if (exchange === "kucoin" && apiPassphrase === null) {
      throw new CustomError({
        message: "Kucoin requires a passphrase",
        status: 400,
        source: "validateAPIKeys",
      });
    }

    const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
    const apiPerms = await session.getAPIPerms();

    return res.status(200).json({apiPerms: apiPerms });
  } catch (e) {
    if (e instanceof CustomError) {
      next(e);
    } else {
      console.log(e);
      next(
        new CustomError({
          message: "An error occurred while fetching the API Key Permissions.",
          status: 500,
          source: "validateAPIKeys",
        })
      );
    }
  }
});

module.exports = router;
