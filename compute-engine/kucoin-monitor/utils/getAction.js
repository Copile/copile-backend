
// Identifies the meaning of the order and returns it
function getAction(order) {
    const actionMap = {
      "UNKNOWN": {
        "false": {
          "default": "new_order",
        },
        "true": {
          "default": "partial_close",
          "TakeProfit": "new_take_profit",
          "PartialTakeProfit": "new_take_profit",
          "StopLoss": "new_stop_loss",
          "PartialStopLoss": "new_stop_loss"
        }
      },
      "default": {
        "false": {
          "default": "cancelled_order",
        },
        "true": {
          "default": "Unknown",
          "TakeProfit": "cancelled_take_profit",
          "PartialTakeProfit": "cancelled_take_profit",
          "StopLoss": "cancelled_stop_loss",
          "PartialStopLoss": "cancelled_stop_loss"
        }
      }
    };
  
    const cancelType = actionMap[order.cancelType] || actionMap['default'];
    const reduceOnly = cancelType[order.reduceOnly] || cancelType['true'];
    const stopOrderType = reduceOnly[order.stopOrderType] || reduceOnly['default'];
  
    return stopOrderType;
};

module.exports = getAction;

