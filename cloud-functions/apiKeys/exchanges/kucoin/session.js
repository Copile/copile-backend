const ExchangeSession = require("../exchangeSession");
const { getKucoinAPIPerms } = require("./apiPerms");
const CustomError = require("../../utils/error");

/**
 * Represents a KuCoin exchange session.
 * @extends ExchangeSession
 */
class KuCoinSession extends ExchangeSession {
  /**
   * Creates a KuCoinSession instance.
   * @param {string} apiKey - API key for the KuCoin session.
   * @param {string} apiSecret - API secret for the KuCoin session.
   * @param {string} apiPassphrase - API passphrase for the KuCoin session.
   */
  constructor(apiKey, apiSecret, apiPassphrase) {
    super(apiKey, apiSecret);
    this.apiPassphrase = apiPassphrase;
  }

  async getAPIPerms() {
    try {
      return await getKucoinAPIPerms(this.apiKey, this.apiSecret);
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError({
        message: `Failed to fetch KuCoin API Perms: ${error.message}`,
        status: 500,
        source: "getAPIPerms",
      });
    }
  }
}

module.exports = KuCoinSession;
