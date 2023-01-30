// gcp cli command to deploy:
// gcloud functions deploy submitTrade --runtime nodejs14 --trigger-http --allow-unauthenticated --source submitTrade

const request = require("request");
const express = require("express");
const bodyParser = require('body-parser');
const app = express();
app.use(express.urlencoded({ extended: true }));


const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

app.post("/submitTrade", async (req, res) => {
    // create new GCP Cloud Task in "trade-queue" queue

    // create random UUID
    const uuid = (Math.random() * 100).toString();
    
    trade = JSON.stringify(req.body)

    const parent = client.queuePath("copile", "us-central1", "processing-queue");
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
                "Content-Type": "application/json",
            },
            httpMethod: "POST",
            url: "https://preprocessing-layer-zvakwy7kgq-uc.a.run.app/newTrade",
            oidcToken: {
                serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com"
            },
            body: Buffer.from(trade).toString("base64")
        }
    };

    console.log("Adding a new-trade (" + uuid + ") to processing-queue");
    console.log(req.body);


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