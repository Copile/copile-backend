function getAction(order) {

  const newList = {
    "true": {
      "CANCELED": {
        "STOP_MARKET": "cancelled_stop_loss",
        "STOP_LIMIT": "cancelled_stop_loss",
        "TAKE_PROFIT": "cancelled_take_profit",
        "TAKE_PROFIT_MARKET": "cancelled_take_profit"
      },
      "NEW": {
        "MARKET": "partial_close",
        "LIMIT": "partial_close",
        "STOP_MARKET": "new_stop_loss",
        "STOP_LIMIT": "new_stop_loss",
        "TAKE_PROFIT": "new_take_profit",
        "TAKE_PROFIT_MARKET": "new_take_profit"
      },
      "TRADE": {
        "MARKET": "partial_close",
        "LIMIT": "partial_close",
        "STOP_MARKET": "new_stop_loss",
        "STOP_LIMIT": "new_stop_loss",
        "TAKE_PROFIT": "new_take_profit",
        "TAKE_PROFIT_MARKET": "new_take_profit"
      }
    },
    "false": {
      "CANCELED": {
        "MARKET": "cancelled_order",
        "LIMIT": "cancelled_order",
      },
      "NEW": {
        "LIMIT": "new_order",
        "MARKET": "new_order"
      },
      "TRADE": {
        "LIMIT": "new_order",
        "MARKET": "new_order"
      }
    }
  }

  const reduceOnly = newList[order.R] || {};
  const executionType = reduceOnly[order.x] || {};
  const action = executionType[order.o] || "unknown_action";

  return action;
}

module.exports = getAction;
