// gcp cli command to deploy:
// gcloud functions deploy submitTrade --runtime nodejs14 --trigger-http --allow-unauthenticated --source submitTrade

const request = require("request");
const express = require("express");
const bodyParser = require('body-parser');
const app = express();
app.use(express.urlencoded({ extended: true }));


const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

async function addTaskToQueue(type, payload) {
    const parent = client.queuePath("copile", "us-central1", "processing-queue");
    const task = {
        httpRequest: {
            headers: {
                "Content-Type": "application/json",
            },
            httpMethod: "POST",
            url: `https://preprocessing-layer-zvakwy7kgq-uc.a.run.app/${type}`,
            oidcToken: {
                serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com"
            },
            body: Buffer.from(JSON.stringify(payload)).toString("base64")
        }
    };

    const request = { parent, task };
    const [response] = await client.createTask(request);
    const name = response.name;
    console.log(`Created task ${name}`);
}

app.post('/submitTrade', async (req, res) => {
  try {
    // Get the trade data from the request body
    const payload = req.body;

    // Add the trade to the processing queue
    await addTaskToQueue("newTrade", payload);

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
    const payload = req.body;

    // Add the trade to the processing queue
    await addTaskToQueue("submitTP", payload);

    // Return a success response
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
    const payload = req.body;

    // Add the trade to the processing queue
    await addTaskToQueue("submitSL", payload);

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
    const payload = req.body;

    // Add the trade to the processing queue
    await addTaskToQueue("cancelOrder", payload);

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
    const payload = req.body;

    // Add the trade to the processing queue
    await addTaskToQueue("cancelAllOrders", payload);

    // Return a success response
    res.status(200).json({ success: true, message: 'orders cancel submitted successfully.' });
  } catch (err) {
    // Log the error and return an error response
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/", (req, res) => {
    res.send("Copile API");
})

app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    submitTrade: app
}