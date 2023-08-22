const express = require('express');
const applyMiddleware = require('./middleware');
const app = express();
applyMiddleware(app);

const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

app.post('/createBalances', async (req, res) => {
    const parent = client.queuePath("copile", "us-central1", "pre-balance");
    const task = {
        httpRequest: {
            headers: {
                "Content-Type": "application/json",
            },
            httpMethod: "POST",
            url: "https://prebalance-layer-zvakwy7kgq-uc.a.run.app/createBalances",
            oidcToken: {
                serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com"
            },
            body: Buffer.from("x").toString("base64")
        }
    };

    try {
        const request = { parent, task };
        const [response] = await client.createTask(request);
        const name = response.name;
        console.log(`Created task ${name}`);
        res.status(200).send('Task created successfully');
    } catch (error) {
        console.error('Error creating task', error);
        res.status(500).send('Error creating task');
    }
});

// Export the express app as a Cloud Function
exports.createBalances = app;
