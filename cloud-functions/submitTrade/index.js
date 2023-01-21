// gcp cli command to deploy:
// gcloud functions deploy submitTrade --runtime nodejs14 --trigger-http --allow-unauthenticated --source submitTrade

const request = require("request");
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));


const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

app.get("/submitTrade", async (req, res) => {
    // create new GCP Cloud Task in "trade-queue" queue

    // create random UUID
    const uuid = (Math.random() * 100).toString();

    const parent = client.queuePath("miratrading-ltd", "us-east1", "new-trade-queue");
    const task = {
        // appEngineHttpRequest: {
        //     headers: {
        //         "Content-Type": "text/plain",
        //     },
        //     httpMethod: "POST",
        //     relativeUri: "/newTrade", // newTradeHandler/index.js/newTrade
        //     body: Buffer.from(uuid).toString("base64")
        // },
        httpRequest: {
            headers: {
                "Content-Type": "text/plain",
            },
            httpMethod: "POST",
            url: "https://new-trade-handler-sp5g6ee64a-ue.a.run.app/newTrade",
            oidcToken: {
                serviceAccountEmail: "tasks-service-account@miratrading-ltd.iam.gserviceaccount.com"
            },
            body: Buffer.from(uuid).toString("base64")
        }
    };

    console.log("Adding a new-trade (" + uuid + ") to new-trade-queue");


    const request = { parent, task };
    const [response] = await client.createTask(request);
    const name = response.name;
    console.log(`Created task ${name}`);

    return res.send(JSON.stringify({ status: 200 }));
});

app.get("/", (req, res) => {
    res.send("Hello World");
})

app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    submitTrade: app
}