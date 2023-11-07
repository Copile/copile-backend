const BingXSession = require("./bingx/session");
const CustomError = require("../utils/error");

/**
 * Factory function to create an exchange session.
 * @param {string} exchange - The name of the exchange ("kucoin", "binance", "bingx", "testnet").
 * @param {string} apiKey - API key for the session.
 * @param {string} apiSecret - API secret for the session.
 * @param {string} [apiPassphrase] - API passphrase for the session (optional, only for KuCoin).
 * @returns {Object} An instance of the relevant session class.
 * @throws {CustomError} Throws a custom error if the exchange is unknown.
 */
function createSession(exchange, apiKey, apiSecret, apiPassphrase) {
  switch (exchange) {
    case "kucoin":
        return
        //return new KuCoinSession(apiKey, apiSecret, apiPassphrase);
    case "binance":
        return
        //return new BinanceSession(apiKey, apiSecret);
    case "bingx":
        return new BingXSession(apiKey, apiSecret);
    case "testnet":
        return
        //return new TestnetSession(apiKey, apiSecret);
    default:
      throw new CustomError({
        message: "Unknown Exchange",
        status: 400,
        source: "createSession",
      });
  }
}

module.exports = createSession;
