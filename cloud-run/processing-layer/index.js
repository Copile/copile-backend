const { CloudTasksClient } = require("@google-cloud/tasks");
const { Firestore } = require('@google-cloud/firestore')
const firestore = new Firestore
const client = new CloudTasksClient();
const { v4: uuidv4 } = require('uuid');
const bodyParser = require("body-parser");
const express = require("express");
const queryString = require('querystring');


const app = express();
app.enable("trust proxy");

app.use(bodyParser.text({type:"*/*"}));

async function addTaskToQueue(type, trade_data) {
    
    const parent = client.queuePath("copile", "us-central1", "trade-queue");
    const task = {
        httpRequest: {
            headers: {
                "Content-Type": "application/json",
            },
            httpMethod: "POST",
            url: `https://trade-handler-zvakwy7kgq-uc.a.run.app/${type}`,
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
}

app.post('/newTrade', async (req, res) => {
    try {
        console.log(req.body);
        const trade = queryString.parse(req.body)
        console.log(trade);
        const { planId, exchanges, payload } = trade;
        const trade_ID = uuidv4();

        const trade_data = {
            "trade_ID": trade_ID,
            "user": "x",
            "body": payload,
            "exchange": "x",
        }

        const plansRef = firestore.collectionGroup('plans');
        const matchingPlans = await plansRef.where('product', '==', planId).get();
        matchingPlans.forEach(async (doc) => {
            const userId = doc.ref.parent.parent.id;
            trade_data.user = userId
            const userDoc = await firestore.collection('users').doc(userId).get()
            const user = userDoc.data();
            const preferredExchange = user.preferred_exchange;
            if (exchanges.includes(preferredExchange)) {
                const exchange = user.exchanges[preferredExchange];
      
                if (exchange.api_key !== 'x' && exchange.api_secret !== 'x') {
                    trade_data.exchange = preferredExchange
                    await addTaskToQueue("send_call", trade_data);
                }
            } else {
                const validExchanges = Object.entries(user.exchanges)
                  .filter(([exchangeName, exchangeData]) => {
                    return (
                      exchanges.includes(exchangeName) &&
                      exchangeData.api_key !== 'x' &&
                      exchangeData.api_secret !== 'x'
                    );
                  });
      
                if (validExchanges.length > 0) {
                  const randomIndex = Math.floor(Math.random() * validExchanges.length);
                  const exchangeName = validExchanges[randomIndex][0];
                  trade_data.exchange = exchangeName
    
                  await addTaskToQueue("send_call", trade_data);
                }
            }
        });
        res.status(200).json({success: true, message: "trade executed successfully"});
    } catch(error) {
        console.log(error);
        res.status(500).json({success: false, message: "Internal server error."});
    }
});

app.post('/submitTP', async (req, res) => {
    try {
        console.log(req.body);
        const trade = queryString.parse(req.body)
        console.log(trade);
        const { trade_ID, payload } = trade;
        const TP_ID = uuidv4();

        const trade_data = {
            'trade_ID': trade_ID,
            'user': "x",
            'payload': payload,
            'TP_ID': TP_ID,
        }
        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', trade_ID).get();
      
        tradeQuery.forEach(async (doc) => {
            const userId = doc.ref.parent.parent.id;
            trade_data.user = userId
            await addTaskToQueue("send_tp", trade_data)
        });
    
        res.status(200).json({ success: true, message: 'take-profit executed successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
});

app.post('/submitSL', async (req, res) => {
    try {
        console.log(req.body);
        const trade = queryString.parse(req.body)
        console.log(trade);
        const { trade_ID, payload } = trade;
        const SL_ID = uuidv4();

        const trade_data = {
            'trade_ID': trade_ID,
            'user': "x",
            'payload': payload,
            'SL_ID': SL_ID,
        }
        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', trade_ID).get();
      
        tradeQuery.forEach(async (doc) => {
            const userId = doc.ref.parent.parent.id;
            trade_data.user = userId
            await addTaskToQueue("send_sl", trade_data)
        });
    
        res.status(200).json({ success: true, message: 'stop-loss executed successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
});

app.post('/cancelOrder', async (req, res) => {
    try {
        console.log(req.body);
        const trade = queryString.parse(req.body)
        console.log(trade);
        const { trade_ID, order_ID, type } = trade;

        const trade_data = {
            'trade_ID': trade_ID,
            'user': "x",
            'Doc_ID': order_ID,
            'type': type
        }
        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', trade_ID).get();
      
        tradeQuery.forEach(async (doc) => {
            const userId = doc.ref.parent.parent.id;
            trade_data.user = userId
            await addTaskToQueue("cancel_order", trade_data)
        });
    
        res.status(200).json({ success: true, message: 'cancel executed successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
});

app.post('/cancelAllOrders', async (req, res) => {
    try {
        console.log(req.body);
        const trade = queryString.parse(req.body)
        console.log(trade);
        const {trade_ID} = trade;

        const trade_data = {
            'trade_ID': trade_ID,
            'user': "x",
        }
        const plansRef = firestore.collectionGroup('trades');
        const tradeQuery = await plansRef.where('tradeID', '==', trade_ID).get();
      
        tradeQuery.forEach(async (doc) => {
            const userId = doc.ref.parent.parent.id;
            trade_data.user = userId
            await addTaskToQueue("cancel_order", trade_data)
        });
    
        res.status(200).json({ success: true, message: 'all orders cancel executed successfully' });
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