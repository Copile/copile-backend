const { CloudTasksClient } = require("@google-cloud/tasks");
const { Firestore } = require("@google-cloud/firestore");
const firestore = new Firestore();
const client = new CloudTasksClient();
const bodyParser = require("body-parser");
const express = require("express");

const app = express();
app.enable("trust proxy");

app.use(bodyParser.text({ type: "*/*" }));

async function addTaskToQueue(type, trade_data) {
  let parent = client.queuePath("copile", "asia-southeast1", "track-queue");
  let url;
  switch (trade_data.exchange) {
    case "bybit":
      url = `https://asia-bybit-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "kucoin":
      url = `https://asia-kucoin-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "binance":
      url = `https://asia-binance-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "bingx":
      url = `https://asia-bingx-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "testnet":
      url = `https://asia-testnet-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
      break;

    case "mt5":
      url = `https://mt5-exec-handler-zvakwy7kgq-uc.a.run.app/${type}`;
      break;

    case "sub_bingx":
      url = `https://asia-sub-bingx-exec-handler-zvakwy7kgq-as.a.run.app/${type}`;
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
  console.log(task);
  const request = { parent, task };
  const [response] = await client.createTask(request);
  const name = response.name;
  console.log(`Created task ${name}`);
}

app.post("/bulkTP", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, take_profits } = trade;

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          user_id: userId,
          trader_id: traderId,
          take_profits: take_profits,
          exchange: doc.get("exchange"),
        };
        tasks.push(addTaskToQueue("bulk_tp", trade_data));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "Bulk take-profit executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/replaceTP", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, orderId, payload } = trade;

    const tradesRef = firestore.collectionGroup("trades");
    const tradeQuery = await tradesRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          trader_id: traderId,
          user_id: userId,
          document_id: orderId,
          payload: payload,
          exchange: doc.get("exchange"),
          user_type: "users",
        };
        tasks.push(addTaskToQueue("replace_tp", trade_data));
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

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          trader_id: traderId,
          user_id: userId,
          payload: payload,
          sl_id: sl_id,
          exchange: doc.get("exchange"),
        };
        tasks.push(addTaskToQueue("send_sl", trade_data));
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

    const tradesRef = firestore.collectionGroup("trades");
    const tradeQuery = await tradesRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          trader_id: traderId,
          user_id: userId,
          document_id: orderId,
          payload: payload,
          exchange: doc.get("exchange"),
        };
        tasks.push(addTaskToQueue("replace_sl", trade_data));
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
    const { tradeId, traderId, document_id, trade_type } = trade;

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          trader_id: traderId,
          user_id: userId,
          document_id: document_id,
          trade_type: trade_type,
          exchange: doc.get("exchange"),
        };
        tasks.push(addTaskToQueue("cancel_order", trade_data));
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

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          trader_id: traderId,
          user_id: userId,
          exchange: doc.get("exchange"),
        };
        tasks.push(addTaskToQueue("cancel_all_orders", trade_data));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "all orders cancel executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/cancelAllTps", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId } = trade;

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          trader_id: traderId,
          user_id: userId,
          exchange: doc.get("exchange"),
        };
        tasks.push(addTaskToQueue("cancel_all_tps", trade_data));
      }
    });

    await Promise.allSettled(tasks);

    res.status(200).json({ success: true, message: "all tps cancel executed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Endpoint for handling bulk order requests
app.post("/bulkOrder", async (req, res) => {
  try {
    console.log("============ Received bulk order request ============");
    // Parse the request body to get the trade data
    const trade = JSON.parse(req.body);
    console.log(`Processing trade data: ${JSON.stringify(trade)}`);

    // If the trade data is not valid, return an error response
    if (!trade) {
      console.log("Invalid trade data received");
      return res.status(400).json({ success: false, message: "Invalid trade data" });
    }

    // Extract the necessary fields from the trade data
    const { plans, exchanges, payload, margin_type, tradeId, traderId, trader_percentage, meta_accounts, sub_bingx } = trade;
    console.log(`Processing trade with ID: ${tradeId} from trader: ${traderId}`);

    // Create an array to store all metaTasks
    const metaTasks = [];
    const subBingxTasks = []

    for (let i = 0; i < meta_accounts.length; i++) {
      let metaTradeData = {
        trade_id: tradeId,
        trader_id: traderId,
        user_id: meta_accounts[i],
        trader_percentage: trader_percentage, 
        payload: payload,
        exchange: 'mt5',
      };
      // Push each metaTasks into the array
      metaTasks.push(addTaskToQueue('bulk_order', metaTradeData));
    }

    for (let i = 0; i < sub_bingx.length; i++) {
      let metaTradeData = {
        trade_id: tradeId,
        trader_id: traderId,
        user_id: sub_bingx[i],
        trader_percentage: trader_percentage,
        margin_type: margin_type, 
        payload: payload,
        exchange: 'sub_bingx',
      };
      // Push each metaTasks into the array
      subBingxTasks.push(addTaskToQueue('bulk_order', metaTradeData));
    }

    // Wait for all metaTasks to complete
    await Promise.all(metaTasks);

    // Get a reference to the Firestore collection of workers across all users > plans > (plan) > **WORKERS**
    const workersAcrossAllUsersRef = firestore.collectionGroup("workers");
    // Initialize an array to hold the tasks to add to the queue
    const tasksToAdd = [];

    console.log("Fetching all matching workers from Firestore");
    // Fetch all workers that match the trader ID and are enabled within every users plan
    const allMatchingWorkers = await workersAcrossAllUsersRef
      .where("id", "==", traderId)
      .where("enabled", "==", true)
      .get();
    // Initialize a set to hold the user IDs of the matching workers
    const userIds = new Set();

    // For each matching worker, find the corresponding user that has the worker enabled and add the user ID to the set
    // this gives us a list of users, who, regardless of plan, have the specified worker enabled
    // FIXME: This disregards the plan and only checks if the worker is enabled
    // In a case where the worker is enabled in multiple plans, the user will be added multiple times
    // and in a case where the worker is in multiple plans for the same user, if the worker is enabled in one plan and disabled in another, the user will still be added to the set
    allMatchingWorkers.forEach((doc) => {
      userIds.add(doc.ref.parent.parent.parent.parent.id);
    });

    console.log("Preparing to process each user with matching workers");
    // For each user ID, create a task to process the user
    const userTasks = Array.from(userIds).map(async (userId) => {
      try {
        console.log(`Processing user ${userId}`);
        // Find the worker document for the user
        const workerDoc = allMatchingWorkers.docs.find((doc) => doc.ref.parent.parent.parent.parent.id === userId);
        // Get the worker data from the worker document
        const workerData = workerDoc.data();
        // Get the preferred exchange from the worker data
        const preferredExchange = workerData.preferred_exchange;

        // If no exchanges are selected, no tasks are added to the queue.
        // If only exchanges are selected, tasks are added for users with enabled worker and with valid exchanges.
        // If only plans are selected, no tasks are added as no valid exchange can be found.
        // If both plans and exchanges are selected, tasks are added for users in the selected plans with valid exchanges.

        // Initialize the trade data for the user
        let currentTradeData = {
          trade_id: tradeId,
          worker_id: traderId,
          user_id: userId,
          payload: payload,
          exchange: preferredExchange,
          margin_type: "ISOLATED",
          plan_id: plans[0],
        };

        // Fetch the user document from Firestore
        const userSnapshot = await firestore.collection("users").doc(userId).get();
        // Get the user data from the user document
        const user = userSnapshot.data();

        // If the preferred exchange is in the list of selected exchanges and the user has valid API keys for the preferred exchange
        if (
          exchanges.includes(preferredExchange) &&
          user.exchanges[preferredExchange]?.api_key !== "x" &&
          user.exchanges[preferredExchange]?.api_secret !== "x"
        ) {
          console.log(`User ${userId} has valid exchange: ${preferredExchange}`);
          // Set the exchange in the trade data to the preferred exchange
          currentTradeData.exchange = preferredExchange;

          console.log(`Adding task to queue for user ${userId}`);
          // Add a task to the queue to execute the trade for the user
          return addTaskToQueue("bulk_order", currentTradeData);
        } else {
          // If the preferred exchange is not in the list of selected exchanges or the user does not have valid API keys for the preferred exchange
          console.log(
            `User ${userId} does not have a valid exchange, selecting one with active api keys randomly`
          );

          // For every exchange in the user's database, we find the ones that are included in the exchanges array
          // and have both an api_key and api_secret that are not equal to "x"
          // This is to ensure that the selected exchange is valid for the user
          const validExchanges = Object.entries(user.exchanges).filter(
            ([exchangeName, exchangeData]) =>
              exchanges.includes(exchangeName) && exchangeData.api_key !== "x" && exchangeData.api_secret !== "x"
          );

          console.log(`Valid exchanges for user ${userId}: ${JSON.stringify(validExchanges)}`);

          // If there are any valid exchanges
          if (validExchanges.length > 0) {
            // Select one randomly
            const randomIndex = Math.floor(Math.random() * validExchanges.length);
            // Set the exchange in the trade data to the randomly selected exchange
            currentTradeData.exchange = validExchanges[randomIndex][0];
            console.log(
              `Selected exchange ${currentTradeData.exchange} and adding task to queue for user ${userId}`
            );
            // Add a task to the queue to execute the trade for the user
            return addTaskToQueue("bulk_order", currentTradeData);
          }
        }
      } catch (error) {
        console.log(`Error processing user ${userId}: ${error}`);
      }
    });

    // Add the user tasks to the array of tasks to add to the queue
    tasksToAdd.push(...userTasks);

    console.log(`Added ${userTasks.length} tasks for users`);

    // Wait for all tasks to settle
    await Promise.allSettled(tasksToAdd);

    console.log("============ All tasks settled ============");
    // Return a success response
    res.status(200).json({ success: true, message: "Bulk order executed successfully" });
  } catch (error) {
    // If an error occurs while executing the bulk order, log the error and return an error response
    console.log(`Error executing bulk order: ${error}`);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/partialClose", async (req, res) => {
  try {
    const trade = JSON.parse(req.body);
    const { tradeId, traderId, percentage } = trade;

    const plansRef = firestore.collectionGroup("trades");
    const tradeQuery = await plansRef.where("tradeID", "==", tradeId).get();

    const tasks = [];
    tradeQuery.forEach((doc) => {
      const userId = doc.ref.parent.parent.id;
      if (userId !== traderId) {
        const trade_data = {
          trade_id: tradeId,
          trader_id: traderId,
          user_id: userId,
          percentage: percentage,
          exchange: doc.get("exchange"),
        };
        tasks.push(addTaskToQueue("partial_close", trade_data));
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
