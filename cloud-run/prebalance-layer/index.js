const { CloudTasksClient } = require("@google-cloud/tasks");
const Firestore = require('@google-cloud/firestore')
const db = new Firestore
const client = new CloudTasksClient();

const bodyParser = require("body-parser");
const express = require("express");

const app = express();
app.enable("trust proxy");

app.use(bodyParser.text({type:"*/*"}));


app.get("/", (req, res) => {
    res.send("Hello world");
});

app.post("/createBalances", async (req, res) => {
    console.log("Received new balance request:", req.body);
    console.log(req.body);

    let users = []
    const query = db.collection('users');
    const snapshot = await query.get();
    snapshot.forEach(doc => {
        user_id = doc.id
        users.push(user_id)
    });

    for(let i = 0; i < users.length; i++) {
        const parent = client.queuePath("copile", "us-central1", "balance-queue");
        const task = {
            httpRequest: {
                headers: {
                    "Content-Type": "text/plain",
                },
                httpMethod: "POST",
                url: "https://prebalance-layer-zvakwy7kgq-uc.a.run.app/createBalance",
                oidcToken: {
                    serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com"
                },
                body: Buffer.from(users[i]).toString("base64")
            }
        };

        const request = { parent, task };
        const [response] = await client.createTask(request);
        const name = response.name;
        console.log("Started balance control", name)
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