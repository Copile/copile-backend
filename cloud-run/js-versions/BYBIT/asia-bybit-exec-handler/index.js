const bodyParser = require("body-parser");
const express = require("express");

const app = express();
app.enable("trust proxy");

app.use(bodyParser.text({ type: "*/*" }));

app.post('/bulk_order', async (req, res) => {
    try {
        const data = req.body;
        const { user_type, trade_id, account_id, payload } = data;
        changeCollection(user_type); // Assuming changeCollection is defined elsewhere
        
        const margin = user_type === "traders" ? data['margin'] : data['plan_id'];
        const { trader_id, exchange } = data;
        const { side, symbol, leverage, entry, take_profits, stop_losses } = payload;

        // Get user keys
        const keys = await getUserKeys(account_id, exchange); // Assuming getUserKeys is defined elsewhere
        
        // Simultaneous asynchronous operations
        const [precision, leverageChange, marginType, positionMode] = await Promise.all([
            bybitPrecision.getPrecision(account_id, symbol, keys),
            bybitSettings.changeLeverage(symbol, leverage, keys),
            bybitSettings.changeMarginType(keys),
            bybitSettings.changePositionMode(keys)
        ]);

        // Send trade
        const orderDict = await bybitTrade.sendTrade(account_id, trade_id, margin, trader_id, side, symbol, leverage, entry, precision, keys);

        // Get trade info
        const tradeInfo = await getTradeInfo(account_id, trade_id); // Assuming getTradeInfo is defined elsewhere

        // Send stop losses
        for (const slData of stop_losses) {
            await bybitStoploss.sendStoploss(
                account_id,
                trade_id,
                slData.sl_id,
                slData.sl_number,
                slData.sl_value,
                slData.sl_percentage,
                parseFloat(tradeInfo.quantity),
                tradeInfo,
                precision,
                keys
            );
        }

        // Calculate and send take profits
        if (take_profits.length > 0) {
            const newTakeProfits = await bybitDistribution.calculateTpAmounts(
                account_id,
                trade_id,
                take_profits,
                tradeInfo,
                parseFloat(tradeInfo.quantity),
                precision,
                keys
            );

            const tasks = newTakeProfits.map(tpData => 
                bybitProfit.sendProfit(
                    account_id,
                    trade_id,
                    tpData.tp_id,
                    tpData.tp_number,
                    tpData.tp_value,
                    tpData.tp_percentage,
                    tpData.tp_amount,
                    tradeInfo,
                    precision,
                    keys
                )
            );

            await Promise.all(tasks);
        }

        const notificationPayload = {
            data: {
                order: orderDict,
                take_profits: take_profits,
                stop_losses: stop_losses
            },
            trade_id: trade_id,
            user_id: account_id
        };
        await sendNotification(notificationPayload, "/trade");

        // Response
        res.status(200).json({ message: "All orders placed successfully" });

    } catch (error) {
        console.error(error);
        if (error.isAxiosError) {
            // Handle connection error
            res.status(503).json({ detail: "Connection error. Please try again later." });
        } else {
            // Handle general error
            res.status(500).json({ detail: error.message });
        }
    }
});

const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`tradeHandler listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
