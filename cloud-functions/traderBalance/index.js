const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { ContractClient } = require('bybit-api');
const api = require("kucoin-futures-node-api");
const { getBalance } = require('./bingxrequest');

const db = new Firestore();
const applyMiddleware = require('./middleware');
const app = express();
applyMiddleware(app);

app.all('/balance/:exchange', async (req, res) => {
    const trader = req.get('traderId');

    if (!trader) {
        return res.status(400).json({ success: false, error: 'Trader ID is missing' });
    }

    const exchange = req.params.exchange;

    try {
        const startTime = Date.now();

        const traderRef = db.collection('traders').doc(trader);
        const traderDoc = await traderRef.get();

        if (!traderDoc.exists) {
            return res.status(404).json({ success: false, error: 'Trader not found' });
        }

        const exchangesData = traderDoc.data().exchanges || {};

        if (!exchangesData || !(exchange in exchangesData)) {
            return res.status(404).json({ success: false, error: 'No exchange found' });
        }

        const keys = exchangesData[exchange];
        if (!('api_key' in keys && keys.api_key !== 'x')) {
            return res.status(404).json({ success: false, error: 'API key not found for the exchange' });
        }

        const apiKey = keys.api_key;
        const apiSecret = await decryptData(keys.api_secret, trader) || null;
        const apiPassphrase = await decryptData(keys.api_passphrase, trader) || null;
        
        if (exchange === 'kucoin' && apiPassphrase === null) {
            return res.status(400).json({ success: false, error: 'Kucoin requires a passphrase' });
        }

        let balance;

        switch (exchange) {
            case 'bybit':
                balance = await getBybitBalance(apiKey, apiSecret);
                break;
            case 'kucoin':
                balance = await getKucoinBalance(apiKey, apiSecret, apiPassphrase);
                break;
            case 'bingx':
                balance = await getBingXBalance(apiKey, apiSecret);
                break;
            default:
                console.log(`Unknown exchange: ${exchange}`);
                balance = [];
        }

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        return res.status(200).json({ success: true, balance: balance, executionTime });

    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

async function getBybitBalance(apiKey, apiSecret) {
    try {
        const client = new ContractClient({
            key: apiKey,
            secret: apiSecret,
            strict_param_validation: true,
        });
        const balance = await client.getBalances(coin = 'USDT');
        return balance.result.list[0];
    }
    catch (e) {
        console.log("Error in getBybitBalance: ", e);
        return [];
    }
}

async function getKucoinBalance(apiKey, apiSecret, apiPassphrase) {
    try {
        const config = {
            apiKey: apiKey,
            secretKey: apiSecret,
            passphrase: apiPassphrase,
            environment: "live",
        };
        const apiLive = new api();
        apiLive.init(config);

        params = {
            currency: "USDT"
        }
        
        const balance = await apiLive.getAccountOverview(params);
        return balance.data;
    }
    catch (e) {
        console.log("Error in getKucoinBalance: ", e);
        return [];
    }
}

async function getBingXBalance(apiKey, apiSecret) {
    try {
        const balance = await getBalance(apiKey, apiSecret);
        return balance.data.data;
    }
    catch (e) {
        console.log("Error in getBingXBalance: ", e);
        return [];
    }
}

exports.traderBalance = app;
