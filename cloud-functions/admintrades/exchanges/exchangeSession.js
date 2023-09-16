class ExchangeSession {
  constructor({ apiKey, apiSecret }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async getOrders(trader_id) {
    throw new Error("Method getOrders must be implemented by subclass");
  }

  async getPositions(user_id) {
    throw new Error("Method getPositions must be implemented by subclass");
  }

  async getBalance() {
    throw new Error("Method getBalance must be implemented by subclass");
  }

  async getOrderStatuses() {
    throw new Error("Method getOrderStatuses must be implemented by subclass");
  }
}
