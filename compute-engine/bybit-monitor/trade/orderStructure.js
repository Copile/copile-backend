
class bulkOrder {
    constructor(traderId, tradeId, traderExchange, exchanges, plans, payload) {
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
        take_profits: payload.take_profits.map(tp => ({
          tp_id: tp.tp_id,
          tp_number: tp.tp_number,
          tp_value: tp.tp_value,
          tp_percentage: tp.tp_percentage,
        })),
        stop_losses: payload.stop_losses.map(sl => ({
          sl_id: sl.sl_id,
          sl_number: sl.sl_number,
          sl_value: sl.sl_value,
          sl_percentage: sl.sl_percentage,
        })),
      };
    }
}