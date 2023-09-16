const ExchangeSession = require('../exchangeSession');
const { getKucoinOrders, getKucoinOrderStatuses } = require('./orders');
const { getKucoinPositions } = require('./positions');
const { getKucoinBalance } = require('./balance');

class KuCoinSession extends ExchangeSession {
  constructor({ apiKey, apiSecret, apiPassphrase }) {
    super({ apiKey, apiSecret });
    this.apiPassphrase = apiPassphrase;
  }

  async getOrders(trader_id) {
    return await getKucoinOrders(this.apiKey, this.apiSecret, this.apiPassphrase, trader_id);
  }

  async getPositions(user_id) {
    return await getKucoinPositions(this.apiKey, this.apiSecret, this.apiPassphrase, user_id);
  }

  async getBalance() {
    return await getKucoinBalance(this.apiKey, this.apiSecret, this.apiPassphrase);
  }

  async getOrderStatuses() {
    return await getKucoinOrderStatuses(this.apiKey, this.apiSecret, this.apiPassphrase);
  }
}

module.exports = KuCoinSession;