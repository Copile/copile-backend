const { CloudTasksClient } = require("@google-cloud/tasks");
const { Firestore } = require('@google-cloud/firestore')
const firestore = new Firestore
const client = new CloudTasksClient();
const bodyParser = require("body-parser");
const express = require("express");

const { buildURL } = require('./urls');
const { fetchActiveInstances } = require('./activeInstances'); // Include the new module
const fs = require('fs');
const path = require('path');

const app = express();
app.enable("trust proxy");

app.use(bodyParser.text({ type: "*/*" }));

// Load regions data from JSON file
const regionsPath = path.join(__dirname, 'regions.json');
const regionsData = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));

// Initialize active instance counts at the start
let activeInstanceCountsByRegion = {};

// Fetch active instance counts and update the variable at the start
async function fetchActive() {
    activeInstanceCountsByRegion = await fetchActiveInstances(regionsData);
}

async function addTaskToQueue(type, trade_data, user_type) {
    // Select a region with less than 10 active instances, or choose a random region
    let selectedRegion = "us-central1"; // Default region

    if (trade_data.exchange === "bybit") {
        // Filter available Asian regions
        const asianRegions = regionsData.regions.asianRegions;
        const availableAsianRegions = asianRegions.filter(region => (activeInstanceCountsByRegion[region] || 0) < 10);

        if (availableAsianRegions.length > 0) {
            selectedRegion = availableAsianRegions[Math.floor(Math.random() * availableAsianRegions.length)];
        }
    } else {
        // Filter available regions based on user type
        const availableRegions = user_type === "trader"
            ? regionsData.regions.traderRegions.filter(region => (activeInstanceCountsByRegion[region] || 0) < 10)
            : Object.keys(regionsData.regions).filter(region => (activeInstanceCountsByRegion[region] || 0) < 10);

        if (availableRegions.length > 0) {
            selectedRegion = availableRegions[Math.floor(Math.random() * availableRegions.length)];
        }
    }


    // Determine exchange and parent regions
    const exchangeRegion = trade_data.exchange || selectedRegion;

    // Validate user type
    if (!["user", "trader"].includes(user_type)) {
        throw new Error("Invalid user_type. It must be either 'user' or 'trader'.");
    }

    // Build URL based on regions and user type
    const url = buildURL(exchangeRegion, user_type, type);
    console.log(url);
    // Create task using Google Cloud client
    const parent = client.queuePath("copile", "us-central1", "trade-queue");

    const task = {
        httpRequest: {
            headers: {
                "Content-Type": "application/json",
            },
            httpMethod: "POST",
            url,
            oidcToken: {
                serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com"
            },
            body: Buffer.from(JSON.stringify(trade_data)).toString("base64")
        }
    };

    const request = { parent, task };
    const [response] = await client.createTask(request);
    const name = response.name;
    console.log(`Created task ${name}`);
    
    // Increment the active instance count for the relevant region
    activeInstanceCountsByRegion[selectedRegion] = (activeInstanceCountsByRegion[selectedRegion] || 0) + 1;
}

async function getExchangeForTrade(traderId, tradeId) {
    try {
        // First, we'll get the user document that contains the trades subcollection
        const userRef = firestore.collection('traders').doc(traderId);

        // Next, we'll get the trade document from the trades subcollection using the tradeId
        const tradeRef = userRef.collection('trades').doc(tradeId);
        const tradeDoc = await tradeRef.get();

        if (!tradeDoc.exists) {
            return "nothing"
        }

        // Assuming there's a field called "exchange" in the trade document
        const exchange = tradeDoc.get('exchange');

        if (!exchange) {
            throw new Error('Exchange information not found in the trade document.');
        }

        return exchange;
    } catch (error) {
        console.error('Error fetching exchange for trade:', error.message);
        throw error;
    }
}

app.post('/newTrade', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { plans, exchanges, payload, tradeId } = trade;

        const trade_data = {
            "trade_id": tradeId,
            "account_id": "x",
            "payload": payload,
            "exchange": "x",
            'plan_id': null,  // Initialize as null
        }

        const plansRef = firestore.collectionGroup('plans');
        const matchingMembers = new Set();  // Store unique member IDs

        // Loop through each plan in the array
        for (const planId of plans) {
            const matchingPlans = await plansRef.where('product', '==', planId).get();

            matchingPlans.forEach(async (doc) => {
                const userId = doc.ref.parent.parent.id;

                if (!matchingMembers.has(userId)) { // Check if member is already processed
                    matchingMembers.add(userId);
                    trade_data.plan_id = planId;  // Update trade_data with current plan ID
                    trade_data.account_id = userId;

                    const userDoc = await firestore.collection('users').doc(userId).get();
                    const user = userDoc.data();
                    const preferredExchange = doc.preferred_exchange;

                    if (exchanges.includes(preferredExchange)) {
                        const exchange = user.exchanges[preferredExchange];

                        if (exchange.api_key !== 'x' && exchange.api_secret !== 'x') {
                            trade_data.exchange = preferredExchange;
                            await addTaskToQueue("send_call", trade_data, "user");
                        }
                    } else {
                        const validExchanges = Object.entries(user.exchanges).filter(([exchangeName, exchangeData]) => {
                            return (
                                exchanges.includes(exchangeName) &&
                                exchangeData.api_key !== 'x' &&
                                exchangeData.api_secret !== 'x'
                            );
                        });

                        if (validExchanges.length > 0) {
                            const randomIndex = Math.floor(Math.random() * validExchanges.length);
                            const exchangeName = validExchanges[randomIndex][0];
                            trade_data.exchange = exchangeName;
                            await addTaskToQueue("send_call", trade_data, "user");
                        }
                    }
                }
            });
        }
        res.status(200).json({ success: true, message: 'Trade executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
});

app.post('/bulkTP', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId, take_profits } = trade;

        const traderData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "take_profits": take_profits,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("bulk_tp", traderData, "trader");

        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'take_profits': take_profits,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("bulk_tp", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'Bulk take-profit executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/submitTP', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, payload, TP_ID } = trade;

        const trade_data = {
            'trade_id': tradeId,
            'account_id': "x",
            'payload': payload,
            'tp_id': TP_ID,
        }
        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', tradeId).get();

        tradeQuery.forEach(async (doc) => {
            const userId = doc.ref.parent.parent.id;
            trade_data.account_id = userId
            await addTaskToQueue("send_tp", trade_data, "user")
        });

        res.status(200).json({ success: true, message: 'take-profit executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/replaceTP', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId, orderId, payload } = trade;

        const traderData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "document_id": orderId,
            "payload": payload,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("replace_tp", traderData, "trader");

        const tradesRef = firestore.collectionGroup('trades');
        const tradeQuery = await tradesRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'document_id': orderId,
                    'payload': payload,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("replace_tp", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'Take-Profit replaced successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/submitSL', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId, payload, sl_id } = trade;
        const traderData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "payload": payload,
            "sl_id": sl_id,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("send_sl", traderData, "trader");

        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'payload': payload,
                    'sl_id': sl_id,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("send_sl", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'stop-loss executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/replaceSL', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId, orderId, payload } = trade;

        const traderData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "document_id": orderId,
            "payload": payload,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("replace_sl", traderData, "trader");

        const tradesRef = firestore.collectionGroup('trades');
        const tradeQuery = await tradesRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'document_id': orderId,
                    'payload': payload,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("replace_sl", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'Stop-Loss replaced successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/cancelOrder', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId, orderId, type } = trade;

        const traderData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "document_id": orderId,
            "trade_type": type,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("cancel_order", traderData, "trader");

        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'document_id': orderId,
                    'trade_type': type,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("cancel_order", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'cancel executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/cancelAllOrders', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId } = trade;

        const traderExecData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("cancel_all_orders", traderExecData, "trader");

        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("cancel_all_orders", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'all orders cancel executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/cancelAllTPs', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId } = trade;

        const traderExecData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("cancel_all_tps", traderExecData, "trader");

        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("cancel_all_tps", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'all tps cancel executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/bulkOrder', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);

        // Execute the trade
        if (trade) {
            const { plans, exchanges, payload, tradeId, traderId, margin, trader_exchange } = trade;

            const traderExecData = {
                "trade_id": tradeId,
                "account_id": traderId,
                "margin": margin,
                "exchange": trader_exchange,
                "payload": payload
            };

            await addTaskToQueue("bulk_order", traderExecData, "trader");

            const trade_data = {
                "trade_id": tradeId,
                "account_id": "x",
                "payload": payload,
                "exchange": "x",
                "plan_id": null, // Initialize as null
            };

            const plansRef = firestore.collectionGroup('plans');
            const tasksToAdd = [];

            // Fetch user data and exchange details in a single Firestore call
            const userIds = new Set();

            for (const planId of plans) {
                const matchingPlans = await plansRef.where('product', '==', planId).get();
                matchingPlans.forEach(doc => {
                    userIds.add(doc.ref.parent.parent.id);
                });
            }

            const usersSnapshot = await firestore.getAll(...Array.from(userIds.values()).map(userId => firestore.collection('users').doc(userId)));

            // Loop through each plan in the array
            for (const planId of plans) {
                const matchingPlans = await plansRef.where('product', '==', planId).get();
                const matchingUserIds = new Set();

                matchingPlans.forEach(doc => {
                    const userId = doc.ref.parent.parent.id;
                    matchingUserIds.add(userId);
                });

                // Filter users to include only those related to the current plan
                const relevantUsers = usersSnapshot.filter(snapshot => matchingUserIds.has(snapshot.id));

                for (const userSnapshot of relevantUsers) {
                    const user = userSnapshot.data();
                    const preferredExchangeDoc = await firestore.collection("users").doc(userSnapshot.id).collection("plans").doc(planId).get();
                    const preferredExchange = preferredExchangeDoc.data().preferred_exchange;

                    if (exchanges.includes(preferredExchange)) {
                        const exchange = user.exchanges[preferredExchange];

                        if (exchange.api_key !== 'x' && exchange.api_secret !== 'x') {
                            trade_data.exchange = preferredExchange;
                            trade_data.account_id = userSnapshot.id;
                            trade_data.plan_id = planId;
                            tasksToAdd.push(addTaskToQueue("bulk_order", trade_data, "user"));
                        }
                    } else {
                        const validExchanges = Object.entries(user.exchanges).filter(([exchangeName, exchangeData]) => {
                            return (
                                exchanges.includes(exchangeName) &&
                                exchangeData.api_key !== 'x' &&
                                exchangeData.api_secret !== 'x'
                            );
                        });

                        if (validExchanges.length > 0) {
                            const randomIndex = Math.floor(Math.random() * validExchanges.length);
                            const exchangeName = validExchanges[randomIndex][0];
                            trade_data.exchange = exchangeName;
                            trade_data.account_id = userSnapshot.id;
                            trade_data.plan_id = planId;
                            tasksToAdd.push(addTaskToQueue("bulk_order", trade_data, "user"));
                        }
                    }
                }
            }

            // Add all tasks to the queue in a single batch
            await Promise.all(tasksToAdd);
        }

        res.status(200).json({ success: true, message: 'Bulk order executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/partialClose', async (req, res) => {
    await fetchActive();
    try {
        const trade = JSON.parse(req.body);
        const { tradeId, traderId, percentage } = trade;

        const traderExecData = {
            "trade_id": tradeId,
            "account_id": traderId,
            "percentage": percentage,
            "exchange": await getExchangeForTrade(traderId, tradeId)
        };

        await addTaskToQueue("partial_close", traderExecData, "trader");

        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', tradeId).get();

        const tasks = [];
        tradeQuery.forEach((doc) => {
            const userId = doc.ref.parent.parent.id;
            if (userId !== traderId) {
                const trade_data = {
                    'trade_id': tradeId,
                    'account_id': userId,
                    'percentage': percentage,
                    'exchange': doc.get('exchange')
                };
                tasks.push(addTaskToQueue("partial_close", trade_data, "user"));
            }
        });

        await Promise.all(tasks);

        res.status(200).json({ success: true, message: 'partial close executed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
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
    console.log('Press Ctrl+C to quit.');
});