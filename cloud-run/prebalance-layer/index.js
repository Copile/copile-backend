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


    for(let i = 0; i < 1; i++) {

        const query = db.collection('users').where('uuid', '==', 'av3FW2jOwQgZexx6ZTFQ');
        const querySnapshot = await query.get();
        console.log(querySnapshot.docs[0].data());

        const uuid = (Math.random() * 100).toString();

        const parent = client.queuePath("copile", "us-central1", "balance-queue");
        const task = {
            httpRequest: {
                headers: {
                    "Content-Type": "text/plain",
                },
                httpMethod: "POST",
                url: "https://trade-handler-zvakwy7kgq-uc.a.run.app/send_call",
                oidcToken: {
                    serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com"
                },
                body: Buffer.from(req.body).toString("base64")
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