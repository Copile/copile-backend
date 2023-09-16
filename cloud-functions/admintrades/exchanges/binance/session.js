const ExchangeSession = require("../exchangeSession");
const { getBinanceOrders, getBinanceOrderStatuses } = require("./orders");
const { getBinancePositions } = require("./positions");
const { getBinanceBalance } = require("./balance");

class BinanceSession extends ExchangeSession {
  constructor({ apiKey, apiSecret }) {
    super({ apiKey, apiSecret });
  }

  async getOrders(trader_id) {
    return await getBinanceOrders(this.apiKey, this.apiSecret, trader_id);
  }

  async getPositions(user_id) {
    return await getBinancePositions(this.apiKey, this.apiSecret, user_id);
  }

  async getBalance() {
    return await getBinanceBalance(this.apiKey, this.apiSecret);
  }

  async getOrderStatuses() {
    return await getBinanceOrderStatuses(this.apiKey, this.apiSecret);
  }
}
