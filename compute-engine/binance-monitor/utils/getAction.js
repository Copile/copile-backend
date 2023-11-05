// ==================== OLD CODE FOR BYBIT ====================
// // Identifies the meaning of the order and returns it
// function getAction(order) {
//     const actionMap = {
//       "UNKNOWN": {
//         "false": {
//           "default": "new_order",
//         },
//         "true": {
//           "default": "partial_close",
//           "TakeProfit": "new_take_profit",
//           "PartialTakeProfit": "new_take_profit",
//           "StopLoss": "new_stop_loss",
//           "PartialStopLoss": "new_stop_loss"
//         }
//       },
//       "default": {
//         "false": {
//           "default": "cancelled_order",
//         },
//         "true": {
//           "default": "Unknown",
//           "TakeProfit": "cancelled_take_profit",
//           "PartialTakeProfit": "cancelled_take_profit",
//           "StopLoss": "cancelled_stop_loss",
//           "PartialStopLoss": "cancelled_stop_loss"
//         }
//       }
//     };

//     const cancelType = actionMap[order.cancelType] || actionMap['default'];
//     const reduceOnly = cancelType[order.reduceOnly] || cancelType['true'];
//     const stopOrderType = reduceOnly[order.stopOrderType] || reduceOnly['default'];

//     return stopOrderType;
// };

// module.exports = getAction;

function getAction(order) {
  // const actionMap = {
  //   NEW: {
  //     MARKET: "new_order",
  //     STOP_MARKET: "new_stop_loss",
  //     LIMIT: "new_limit_order",
  //     STOP_LIMIT: "new_stop_limit_order",
  //   },
  //   FILLED: {
  //     MARKET: "filled_order",
  //     LIMIT: "filled_limit_order",
  //   },
  //   CANCELED: {
  //     MARKET: "cancelled_order",
  //     LIMIT: "cancelled_limit_order",
  //   },
  //   TRADE: {
  //     MARKET: "filled_order",
  //   },
  // };

  const actionMap = {
    NEW: {
      MARKET: "new_order",
      STOP_MARKET: "new_stop_loss",
      LIMIT: "new_limit_order",
      STOP_LIMIT: "new_stop_limit_order",
      TAKE_PROFIT: "new_take_profit", // Add this line
      // Add other order types here...
    },
    FILLED: {
      MARKET: "filled_order",
      LIMIT: "filled_limit_order",
      STOP_MARKET: "filled_stop_loss",
      STOP_LIMIT: "filled_stop_limit_order",
      TAKE_PROFIT: "filled_take_profit", // Add this line
      // Add other order types here...
    },
    CANCELED: {
      MARKET: "cancelled_order",
      LIMIT: "cancelled_limit_order",
      STOP_MARKET: "cancelled_stop_loss",
      STOP_LIMIT: "cancelled_stop_limit_order",
      TAKE_PROFIT: "cancelled_take_profit", // Add this line
      // Add other order types here...
    },
    TRADE: {
      MARKET: "filled_order",
      LIMIT: "filled_limit_order",
      STOP_MARKET: "filled_stop_loss",
      STOP_LIMIT: "filled_stop_limit_order",
      TAKE_PROFIT: "filled_take_profit", // Add this line
      // Add other order types here...
    },
    // Add other statuses here...
  };
  const status = actionMap[order.x] || {};
  const action = status[order.o] || "unknown_action";

  return action;
}

module.exports = getAction;
