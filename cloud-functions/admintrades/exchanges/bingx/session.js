const ExchangeSession = require("../exchangeSession");
const { getBingXOrders, getBingXOrderStatuses } = require("./orders");
const { getBingXPositions } = require("./positions");
const { getBingXBalance } = require("./balance");

class BingXSession extends ExchangeSession {
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);
  }

  async getOrders(trader_id) {
    return await getBingXOrders(this.apiKey, this.apiSecret, trader_id);
  }

  async getPositions(user_id) {
    return await getBingXPositions(this.apiKey, this.apiSecret, user_id);
  }

  async getBalance() {
    return await getBingXBalance(this.apiKey, this.apiSecret);
  }

  async getOrderStatuses() {
    return await getBingXOrderStatuses(this.apiKey, this.apiSecret);
  }
}

module.exports = BingXSession;
