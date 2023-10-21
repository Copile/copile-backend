
class bulkOrder {
    constructor(traderId, tradeId, traderExchange, exchanges, plans, payload, take_profits, stop_losses) {
      this.traderId = traderId;
      this.tradeId = tradeId;
      this.trader_exchange = traderExchange;
      this.exchanges = exchanges;
      this.plans = plans;
      this.payload = {
        side: payload.side,
        symbol: payload.symbol,
        leverage: payload.leverage,
        entry: payload.entry,
        take_profits: take_profits.map(tp => ({
          tp_id: tp.tp_id,
          tp_number: tp.tp_number,
          tp_value: tp.tp_value,
          tp_percentage: tp.tp_percentage,
        })),
        stop_losses: stop_losses.map(sl => ({
          sl_id: sl.sl_id,
          sl_number: sl.sl_number,
          sl_value: sl.sl_value,
          sl_percentage: sl.sl_percentage,
        })),
      };
    }
}

class bulkTP {
  constructor(traderId, tradeId, takeProfits) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.take_profits = takeProfits;
  }
}

class stopLoss {
  constructor(traderId, tradeId, slId, slNumber, slValue, slPercentage) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.SL_ID = slId;
    this.payload = {
      sl_number: slNumber,
      sl_value: slValue,
      sl_percentage: slPercentage,
    };
  }
}

class cancelOrder {
  constructor(traderId, tradeId, documentId, orderType) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.orderId = documentId;
    this.type = orderType;
  }
}

class cancelAll {
  constructor(traderId, tradeId) {
    this.traderId = traderId;
    this.tradeId = tradeId
  }
}

class partialClose {
  constructor(traderId, tradeId, percentage) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.percentage = percentage;
  }
}

module.exports = {
  bulkOrder,
  bulkTP,
  stopLoss,
  cancelOrder,
  cancelAll,
  partialClose
};