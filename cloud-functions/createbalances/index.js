const { CloudTasksClient } = require("@google-cloud/tasks");
const client = new CloudTasksClient();

exports.createBalances = async (event, context) => {
    const message = event.data
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

    console.log("Adding a new-trade (" + uuid + ") to processing-queue");


    const request = { parent, task };
    const [response] = await client.createTask(request);
    const name = response.name;
    console.log(`Created task ${name}`);
};
