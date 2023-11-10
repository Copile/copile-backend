const BinanceSession = require("./binance/session");
const BingXSession = require("./bingx/session");
const BybitSession = require("./bybit/session");
const KuCoinSession = require("./kucoin/session");
const TestnetSession = require("./testnet/session");
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
    case "binance":
      return new BinanceSession(apiKey, apiSecret);
    case "bingx":
      return new BingXSession(apiKey, apiSecret);
    case "bybit":
      return new BybitSession(apiKey, apiSecret);
    case "kucoin":
      return new KuCoinSession(apiKey, apiSecret, apiPassphrase);
    case "testnet":
      return new TestnetSession(apiKey, apiSecret);

    default:
      throw new CustomError({
        message: "Unknown Exchange",
        status: 400,
        source: "createSession",
      });
  }
}

module.exports = createSession;
