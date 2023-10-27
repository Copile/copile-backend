const { CloudTasksClient } = require("@google-cloud/tasks");
const { Firestore } = require("@google-cloud/firestore");
const firestore = new Firestore();
const client = new CloudTasksClient();
const bodyParser = require("body-parser");
const express = require("express");

const app = express();
app.enable("trust proxy");

app.use(bodyParser.text({ type: "*/*" }));

async function addTaskToQueue(type, trade_data, user_type) {
  let parent;
  let url;

  switch (trade_data.exchange) {
    case "bybit":
      parent = client.queuePath("copile", "asia-southeast1", "trade-queue");
      url =
        type === "send_tp" || type === "send_sl"
          ? `https://asia-bybit-track-handler-zvakwy7kgq-as.a.run.app/${type}`
          : `https://asia-bybit-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "kucoin":
      parent = client.queuePath("copile", "asia-southeast1", "trade-queue");
      url =
        type === "send_tp" || type === "send_sl"
          ? `https://asia-kucoin-track-handler-zvakwy7kgq-as.a.run.app/${type}`
          : `https://asia-kucoin-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "binance":
      parent = client.queuePath("copile", "asia-southeast1", "trade-queue");
      url =
        type === "send_tp" || type === "send_sl"
          ? `https://asia-binance-track-handler-zvakwy7kgq-as.a.run.app/${type}`
          : `https://asia-binance-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "bingx":
      parent = client.queuePath("copile", "asia-southeast1", "trade-queue");
      url =
        type === "send_tp" || type === "send_sl"
          ? `https://asia-bingx-track-handler-zvakwy7kgq-as.a.run.app/${type}`
          : `https://asia-bingx-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;
    case "testnet":
      parent = client.queuePath("copile", "asia-southeast1", "trade-queue");
      url =
        type === "send_tp" || type === "send_sl"
          ? `https://asia-testnet-track-handler-zvakwy7kgq-as.a.run.app/${type}`
          : `https://asia-testnet-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    default:
      throw new Error(
        "Invalid exchange. Supported exchanges are 'bybit', 'kucoin', 'binance', bingx and testnet'."
      );
  }

  const task = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json",
      },
      httpMethod: "POST",
      url,
      oidcToken: {
        serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com",
      },
      body: Buffer.from(JSON.stringify(trade_data)).toString("base64"),
    },
  };
  const request = { parent, task };
  const [response] = await client.createTask(request);
  const name = response.name;
  console.log(`Created task ${name}`);
}

async function getExchangeForTrade(traderId, tradeId) {
  try {
    // First, we'll get the user document that contains the trades subcollection
    const userRef = firestore.collection("traders").doc(traderId);

    // Next, we'll get the trade document from the trades subcollection using the tradeId
    const tradeRef = userRef.collection("trades").doc(tradeId);
    const tradeDoc = await tradeRef.get();

    if (!tradeDoc.exists) {
      return "nothing";
    }

    // Assuming there's a field called "exchange" in the trade document
    const exchange = tradeDoc.get("exchange");

    if (!exchange) {
      throw new Error("Exchange information not found in the trade document.");
    }

    return exchange;
  } catch (error) {
    console.log("Error fetching exchange for trade:", error.message);
    throw error;
  }
}

app.post("/newTrade", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { plans, exchanges, payload, tradeId } = trade;

    const trade_data = {
      trade_id: tradeId,
      account_id: "x",
      payload: payload,
      exchange: "x",
      plan_id: null, // Initialize as null
    };

    const plansRef = firestore.collectionGroup("plans");
    const matchingMembers = new Set(); // Store unique member IDs

    // Loop through each plan in the array
    for (const planId of plans) {
      const matchingPlans = await plansRef.where("product", "==", planId).get();

      matchingPlans.forEach(async (doc) => {
        const userId = doc.ref.parent.parent.id;

        if (!matchingMembers.has(userId)) {
          // Check if member is already processed
          matchingMembers.add(userId);
          trade_data.plan_id = planId; // Update trade_data with current plan ID
          trade_data.account_id = userId;

          const userDoc = await firestore.collection("users").doc(userId).get();
          const user = userDoc.data();
          const preferredExchange = doc.preferred_exchange;

          if (exchanges.includes(preferredExchange)) {
            const exchange = user.exchanges[preferredExchange];

            if (exchange.api_key !== "x" && exchange.api_secret !== "x") {
              trade_data.exchange = preferredExchange;
              await addTaskToQueue("send_call", trade_data, "user");
            }
          } else {
            const validExchanges = Object.entries(user.exchanges).filter(
              ([exchangeName, exchangeData]) => {
                return (
                  exchanges.includes(exchangeName) &&
                  exchangeData.api_key !== "x" &&
                  exchangeData.api_secret !== "x"
                );
              }
            );

            if (validExchanges.length > 0) {
              const randomIndex = Math.floor(Math.random() * validExchanges.length);
              const exchangeName = validExchanges[randomIndex][0];
              trade_data.exchange = exchangeName;
              await addTaskToQueue("send_call", trade_data, "user");
            }
          }
        }
      });
    }
    res.status(200).json({ success: true, message: "Trade executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

app.post("/bulkTP", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, take_profits } = trade;

    const traderExecData = {
      trade_id: tradeId,
      account_id: traderId,
      take_profits: take_profits,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    if (traderId === process.env.testID) {
      await addTaskToQueue("bulk_tp", traderExecData, "test");
    } else {
      await addTaskToQueue("bulk_tp", traderExecData, "trader");
    }

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          take_profits: take_profits,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("bulk_tp", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "Bulk take-profit executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/submitTP", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, payload, TP_ID } = trade;

    const trade_data = {
      trade_id: tradeId,
      account_id: "x",
      payload: payload,
      tp_id: TP_ID,
      user_type: "users",
    };
    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    tradeQuery.forEach(async (doc) => {
      const userId = doc.ref.parent.parent.id;
      trade_data.account_id = userId;
      await addTaskToQueue("send_tp", trade_data, "user");
    });

    res.status(200).json({ success: true, message: "take-profit executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/replaceTP", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, orderId, payload } = trade;

    const traderData = {
      trade_id: tradeId,
      account_id: traderId,
      document_id: orderId,
      payload: payload,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    await addTaskToQueue("replace_tp", traderData, "trader");

    const tradesRef = firestore.collectionGroup("trades");
    const tradeQuery = await tradesRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          document_id: orderId,
          payload: payload,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("replace_tp", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "Take-Profit replaced successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/submitSL", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, payload, sl_id } = trade;
    const traderExecData = {
      trade_id: tradeId,
      account_id: traderId,
      payload: payload,
      sl_id: sl_id,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    if (traderId === process.env.testID) {
      await addTaskToQueue("send_sl", traderExecData, "test");
    } else {
      await addTaskToQueue("send_sl", traderExecData, "trader");
    }

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          payload: payload,
          sl_id: sl_id,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("send_sl", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "stop-loss executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/replaceSL", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, orderId, payload } = trade;

    const traderExecData = {
      trade_id: tradeId,
      account_id: traderId,
      document_id: orderId,
      payload: payload,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    if (traderId === process.env.testID) {
      await addTaskToQueue("replace_sl", traderExecData, "test");
    } else {
      await addTaskToQueue("replace_sl", traderExecData, "trader");
    }

    const tradesRef = firestore.collectionGroup("trades");
    const tradeQuery = await tradesRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          document_id: orderId,
          payload: payload,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("replace_sl", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "Stop-Loss replaced successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/cancelOrder", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, orderId, type } = trade;

    const traderExecData = {
      trade_id: tradeId,
      account_id: traderId,
      document_id: orderId,
      trade_type: type,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    if (traderId === process.env.testID) {
      await addTaskToQueue("cancel_order", traderExecData, "test");
    } else {
      await addTaskToQueue("cancel_order", traderExecData, "trader");
    }

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          document_id: orderId,
          trade_type: type,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("cancel_order", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "cancel executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/cancelAllOrders", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId } = trade;

    const traderExecData = {
      trade_id: tradeId,
      account_id: traderId,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    if (traderId === process.env.testID) {
      await addTaskToQueue("cancel_all_orders", traderExecData, "test");
    } else {
      await addTaskToQueue("cancel_all_orders", traderExecData, "trader");
    }

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("cancel_all_orders", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "all orders cancel executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/cancelAllTPs", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId } = trade;

    const traderExecData = {
      trade_id: tradeId,
      account_id: traderId,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    if (traderId === process.env.testID) {
      await addTaskToQueue("cancel_all_tps", traderExecData, "test");
    } else {
      await addTaskToQueue("cancel_all_tps", traderExecData, "trader");
    }

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("cancel_all_tps", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "all tps cancel executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/bulkOrder", async (req, res) => {
  try {
    console.log("Received bulk order request");
    const trade = JSON.parse(req.body);
    console.log(`Processing trade data: ${JSON.stringify(trade)}`);

    if (!trade) {
      console.log("Invalid trade data received");
      return res.status(400).json({ success: false, message: "Invalid trade data" });
    }

    const { plans, exchanges, payload, tradeId, traderId, margin, trader_exchange } = trade;
    console.log(`Processing trade with ID: ${tradeId} from trader: ${traderId}`);
    const traderExecData = {
      trade_id: tradeId,
      trader_id: traderId,
      account_id: traderId,
      margin: margin,
      exchange: trader_exchange,
      payload: payload,
      user_type: "traders",
    };

    console.log(`Preparing to add task for trader: ${traderId}`);
    const traderTask =
      traderId === process.env.testID
        ? addTaskToQueue("bulk_order", traderExecData, "test")
        : addTaskToQueue("bulk_order", traderExecData, "trader");
    console.log(`Added task for trader: ${traderId}`);

    const workersRef = firestore.collectionGroup("workers");
    const tasksToAdd = [traderTask];

    console.log("Fetching all matching workers from Firestore");
    const allMatchingWorkers = await workersRef
      .where("id", "==", traderId)
      .where("enabled", "==", true)
      .get();
    const userIds = new Set();

    allMatchingWorkers.forEach((doc) => {
      userIds.add(doc.ref.parent.parent.parent.parent.id);
    });

    console.log("Preparing to process each user with matching workers");
    const userTasks = Array.from(userIds).map(async (userId) => {
      try {
        console.log(`Processing user ${userId}`);
        const workerDoc = allMatchingWorkers.docs.find(
          (doc) => doc.ref.parent.parent.parent.parent.id === userId
        );
        const workerData = workerDoc.data();
        const preferredExchange = workerData.preferred_exchange;

        let currentTradeData = {
          trade_id: tradeId,
          trader_id: traderId,
          account_id: userId,
          payload: payload,
          exchange: "",
          plan_id: plans[0],
          user_type: "users",
        };

        const userSnapshot = await firestore.collection("users").doc(userId).get();
        const user = userSnapshot.data();

        if (
          exchanges.includes(preferredExchange) &&
          user.exchanges[preferredExchange]?.api_key !== "x" &&
          user.exchanges[preferredExchange]?.api_secret !== "x"
        ) {
          console.log(`User ${userId} has valid exchange: ${preferredExchange}`);
          currentTradeData.exchange = preferredExchange;
          return addTaskToQueue("bulk_order", currentTradeData, "user");
        } else {
          console.log(
            `User ${userId} does not have a valid exchange, selecting one with active api keys randomly`
          );
          const validExchanges = Object.entries(user.exchanges).filter(
            ([exchangeName, exchangeData]) =>
              exchanges.includes(exchangeName) &&
              exchangeData.api_key !== "x" &&
              exchangeData.api_secret !== "x"
          );

          if (validExchanges.length > 0) {
            const randomIndex = Math.floor(Math.random() * validExchanges.length);
            currentTradeData.exchange = validExchanges[randomIndex][0];
            console.log(`Selected exchange ${currentTradeData.exchange} for user ${userId}`);
            return addTaskToQueue("bulk_order", currentTradeData, "user");
          }
        }
      } catch (error) {
        console.log(`Error processing user ${userId}: ${error}`);
      }
    });

    tasksToAdd.push(...userTasks);
    console.log(`Added ${userTasks.length} tasks for users`);

    await Promise.allSettled(tasksToAdd);
    console.log("All tasks settled");
    res.status(200).json({ success: true, message: "Bulk order executed successfully" });
  } catch (error) {
    console.log(`Error executing bulk order: ${error}`);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/partialClose", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, percentage } = trade;

    const traderExecData = {
      trade_id: tradeId,
      account_id: traderId,
      percentage: percentage,
      exchange: await getExchangeForTrade(traderId, tradeId),
      user_type: "traders",
    };

    if (traderId === process.env.testID) {
      await addTaskToQueue("partial_close", traderExecData, "test");
    } else {
      await addTaskToQueue("partial_close", traderExecData, "trader");
    }

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          account_id: userId,
          percentage: percentage,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("partial_close", trade_data, "user"));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "partial close executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("*", (req, res) => {
  res.send("OK").end();
});

app.get("/", (req, res) => {
  res.send("Copile API");
});

const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`tradeHandler listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
