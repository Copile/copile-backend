
class BulkOrder {
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

class BulkTP {
  constructor(traderId, tradeId, takeProfits) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.take_profits = takeProfits;
  }
}

class StopLoss {
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

class ReplaceSl {
  constructor(traderId, tradeId, documentId, slId, slNumber, slValue, slPercentage) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.orderId = documentId;
    this.payload = {
      sl_id: slId,
      sl_number: slNumber,
      sl_value: slValue,
      sl_percentage: slPercentage
    }
  }
}

class CancelOrder {
  constructor(traderId, tradeId, documentId, orderType) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.orderId = documentId;
    this.type = orderType;
  }
}

class CancelAll {
  constructor(traderId, tradeId) {
    this.traderId = traderId;
    this.tradeId = tradeId
  }
}

class PartialClose {
  constructor(traderId, tradeId, percentage) {
    this.traderId = traderId;
    this.tradeId = tradeId;
    this.percentage = percentage;
  }
}

module.exports = {
  BulkOrder,
  BulkTP,
  StopLoss,
  CancelOrder,
  CancelAll,
  PartialClose,
  ReplaceSl
};