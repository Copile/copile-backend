const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

const bodyParser = require("body-parser");
const express = require("express");

const app = express();
app.enable("trust proxy");

app.use(bodyParser.raw({type: "application/octet-stream"}));


app.get("/", (req, res) => {
    res.send("Hello world");
});

app.post("/newTrade", async (req, res) => {
    console.log("Received new trade:", req.body);
    console.log(req.body);


    for(let i = 0; i < 5; i++) {
        const uuid = (Math.random() * 100).toString();

        const parent = client.queuePath("miratrading-ltd", "us-east1", "trade-queue");
        const task = {
            httpRequest: {
                headers: {
                    "Content-Type": "text/plain",
                },
                httpMethod: "POST",
                url: "https://trade-handler-sp5g6ee64a-ue.a.run.app/trade",
                oidcToken: {
                    serviceAccountEmail: "tasks-service-account@miratrading-ltd.iam.gserviceaccount.com"
                },
                body: Buffer.from(uuid).toString("base64")
            }
        };
        const request = { parent, task };
        const [response] = await client.createTask(request);
        const name = response.name;
        console.log("Created trade", name);
    }

    res.send(JSON.stringify({handled: true}));
});

app.get("*", (req, res) => {
    res.send("OK").end();
});




const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`tradeHandler listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});