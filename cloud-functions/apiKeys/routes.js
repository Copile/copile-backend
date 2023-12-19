const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const decryptData = require("./utils/decryption");
const createSession = require("./exchanges/sessionFactory");
const validateEntity = require("./middleware/validation");
const CustomError = require("./utils/error");

const router = express.Router();
const db = new Firestore();

router.post("/validate/:exchange", validateEntity, async (req, res, next) => {
  const entityId = req.get("traderId") || req.get("userId");
  const exchange = req.params.exchange;

  const apiKey = req.body.api_key;
  var apiSecret = req.body.api_secret;
  var apiPassphrase = req.body.api_passphrase || null;

  try {
    console.log(`Starting validation for exchange: ${exchange}`);
    if (!apiKey || !apiSecret) {
      console.log("API credentials are missing.");
      throw new CustomError({
        message: "API credentials are required.",
        status: 400,
        source: "validateAPIKeys",
      });
    }
    console.log("Decrypting API Secret...");
    apiSecret = await decryptData(apiSecret, entityId);
    console.log("Decrypted API Secret successfully.", apiSecret);

    if (apiPassphrase) {
      console.log("Decrypting API Passphrase...");
      apiPassphrase = await decryptData(apiPassphrase, entityId);
      console.log("Decrypted API Passphrase successfully.", apiPassphrase);
    }

    if (exchange === "kucoin" && apiPassphrase === null) {
      console.log("Kucoin requires a passphrase but it's missing.");
      throw new CustomError({
        message: "Kucoin requires a passphrase",
        status: 400,
        source: "validateAPIKeys",
      });
    }
    console.log("Creating session...");
    const session = createSession(exchange, apiKey, apiSecret, apiPassphrase);
    console.log("Fetching API Permissions...");
    const apiPermsResponse = await session.getAPIPerms();
    console.log("Api permissions response: ", apiPermsResponse);

    console.log("API Permissions fetched successfully.");
    return res.status(200).json(apiPermsResponse);
  } catch (e) {
    console.log("An error occurred: ", e);
    if (e instanceof CustomError) {
      next(e);
    } else {
      console.log("An error occurred while fetching the API Key Permissions.", e);
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
