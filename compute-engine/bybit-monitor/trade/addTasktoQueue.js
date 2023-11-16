const CustomError = require("../firestore/error.js");
const endpoints = require('./endpoints.json');
const axios = require('axios');

require('dotenv').config({ path: '../.env' });
const targetUrl = process.env.TARGET_URL;

async function addTaskToQueue(accountId, action, body) {
    // Define the target URL for the task
    let url = targetUrl + endpoints[action];
    console.log(url);
    console.log(body);
    try {
        //Make the API call to create the task
        const response = await axios.post(url, body, {
            headers: {
                'Content-Type': 'application/json',
                'traderId': accountId
            }
        });

        //Log the response from the server
        console.log(`Created task with response: ${JSON.stringify(response.data)}`);
        return
    } catch (error) {
        throw new CustomError({
            message: `Error creating task for queue: ${error.message}`,
            status: 500,
            source: "addTaskToQueue",
        });
    }
}

module.exports = addTaskToQueue;