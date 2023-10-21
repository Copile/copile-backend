// const { CloudTasksClient } = require('@google-cloud/tasks');
const CustomError = require("../firestore/error.js");
const endpoints = require('./endpoints.json');
const path = require('path');
require('dotenv').config({ path: '../.env' });

const targetUrl = process.env.targetUrl;

// async function addTaskToQueue(action, body) {
//     // Initialize the Google Cloud Tasks client
//     const client = new CloudTasksClient();
  
//     // Define parent queue name
//     const parent = client.queuePath("copile", "asia-southeast1", "processing-queue");
  
//     // Define the target URL for the task
//     let url = "YOUR_TARGET_URL" + endpoints[action]; // Replace with your actual URL
  
//     try {
//       // Create the task object
//       const task = {
//         httpRequest: {
//           // Headers
//           headers: {
//             "Content-Type": "application/json",
//           },
//           httpMethod: "POST",
//           url: url,
//           // OIDC Token for authentication
//           oidcToken: {
//             serviceAccountEmail: "tasks-service-account@copile.iam.gserviceaccount.com",
//           },
//           // Task payload
//           body: Buffer.from(JSON.stringify(body)).toString("base64"),
//         },
//       };
  
//       // Create request object
//       const request = { parent, task };
  
//       // Make the API call to create the task
//       const [response] = await client.createTask(request);
  
//       // Log the name of the task created
//       const name = response.name;
//       console.log(`Created task ${name}`);
//     } catch (error) {
//         throw new CustomError({
//             message: `Error creating task for queue: ${error.message}`,
//             status: 500,
//             source: "addTaskToQueue",
//         });
//     }
// }

async function addTaskToQueue(accountId, action, body) {
  // Define the target URL for the task
  let url = targetUrl + endpoints[action]; // Replace with your actual URL

  try {
      // Make the API call to create the task
      const response = await axios.post(url, body, {
          headers: {
              'Content-Type': 'application/json',
              'traderId': accountId
          }
      });

      // Log the response from the server
      console.log(`Created task with response: ${JSON.stringify(response.data)}`);
  } catch (error) {
      throw new CustomError({
          message: `Error creating task for queue: ${error.message}`,
          status: 500,
          source: "addTaskToQueue",
      });
  }
}

module.exports = addTaskToQueue;