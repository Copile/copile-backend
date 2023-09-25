const { ContractClient } = require('bybit-api');

async function getTestnetBalance(apiKey, apiSecret) {
    try {
        const client = new ContractClient({
            key: apiKey,
            secret: apiSecret,
            strict_param_validation: true,
        });
        const balance = await client.getBalances(coin = 'USDT');
        return balance.result.list[0].availableBalance;
    }
    catch (e) {
        throw new CustomError({
            message: `Failed to fetch testnet balance: ${e.message}`,
            status: 500,
            source: "getTestnetPositions",
        });
    }
}

module.exports = { getTestnetBalance };