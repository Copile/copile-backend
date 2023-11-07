const express = require("express");
const applyMiddleware = require('./middleware');
const { traderCheck, checkIfTradeExists } = require('./verification');
const app = express();
applyMiddleware(app);

const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

async function addTaskToQueue(type, payload, method) {
  const parent = client.queuePath("copile", "us-central1", "processing-queue");
  const task = {
    httpRequest: {
      headers: {
        "Content-Type": "application/json",
      },
      httpMethod: method,
      url: `${process.env.preprocessinglayer}/${type}`,
      oidcToken: {
        serviceAccountEmail: `${process.env.serviceaccount}`
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64")
    }
  };

  const request = { parent, task };
  const [response] = await client.createTask(request);
  const name = response.name;
  console.log(`Created task ${name}`);
}

app.post('/newTrade', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }

    // Add the traderId to the request body
    tradeData.traderId = traderId;

    // Add the trade to the processing queue
    await addTaskToQueue("newTrade", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'trade submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/submitTP', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }
    
    // Add the traderId to the request body
    tradeData.traderId = traderId;

    // Add the trade to the processing queue
    await addTaskToQueue("submitTP", tradeData, "POST");

    res.status(200).json({ success: true, message: 'take-profit submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/submitSL', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }
    
    

    // Add the traderId to the request body
    tradeData.traderId = traderId;

    // Add the trade to the processing queue
    await addTaskToQueue("submitSL", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'stop-loss submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/cancelOrder', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }

    

    // Add the traderId to the request body
    tradeData.traderId = traderId;

    // Add the trade to the processing queue
    await addTaskToQueue("cancelOrder", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'order cancel submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/cancelAllOrders', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }

    

    // Add the traderId to the request body
    tradeData.traderId = traderId;

    // Add the trade to the processing queue
    await addTaskToQueue("cancelAllOrders", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'orders cancel submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/cancelAllTPs', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }

    // Add the traderId to the request body
    tradeData.traderId = traderId;

    // Add the trade to the processing queue
    await addTaskToQueue("cancelAllTPs", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'orders cancel submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/bulkOrder', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }

    // Add the traderId to the tradeData
    tradeData.traderId = traderId;

    await addTaskToQueue("bulkOrder", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'Trade submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/bulkTP', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }

    // Add the traderId to the tradeData
    tradeData.traderId = traderId;

    await addTaskToQueue("bulkTP", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'Trade submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/replaceTP', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }
    
    

    // Add the traderId to the tradeData
    tradeData.traderId = traderId;

    await addTaskToQueue("replaceTP", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'Trade replacement submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/replaceSL', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];

    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }
    
    

    // Add the traderId to the tradeData
    tradeData.traderId = traderId;

    await addTaskToQueue("replaceSL", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'Trade replacement submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/partialClose', async (req, res) => {
  try {
    // Get the trade data from the request body
    const tradeData = req.body;

    const traderId = req.headers['traderid'];
    
    const exists = await traderCheck(traderId);
    if (!exists) {
      return res.status(400).json({ success: false, message: 'Trader does not exist.' });
    }

    

    // Add the traderId to the request body
    tradeData.traderId = traderId;

    // Add the trade to the processing queue
    await addTaskToQueue("partialClose", tradeData, "POST");

    // Return a success response
    res.status(200).json({ success: true, message: 'Order part closed successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Copile API");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

// expose the express app as a cloud function
module.exports = {
  submitTrade: app
};
