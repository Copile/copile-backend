const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();
const { getPublicKey } = require("./encryption");

const express = require("express");
const app = express();

app.post("/updateExchange", async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  const userDoc = await db.collection("users").doc(userId).get();

  if (!userDoc.exists) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  const request_exchange = req.body.exchange;
  const exchange = request_exchange.toLowerCase();
  const api_key = req.body.api_key;
  const api_secret = req.body.api_secret;
  const api_passphrase = req.body.api_passphrase;
  const userRef = db.collection("users").doc(userId);

  // check if api_passphrase is required
  if (exchange === "kucoin" && !api_passphrase) {
    res.status(400).json({ success: false, error: `api_passphrase is required for ${exchange} exchange` });
  } else {
    try {
      const updateFields = {
        [`exchanges.${exchange}.api_key`]: api_key,
        [`exchanges.${exchange}.api_secret`]: api_secret,
      };

      if (exchange === "kucoin") {
        updateFields[`exchanges.${exchange}.api_passphrase`] = api_passphrase;
      }

      userRef
        .update(updateFields)
        .then(() => {
          console.log(`Exchange information updated successfully - ${userId}!`);
          res.status(200).json({
            success: true,
            message: `Exchange information updated successfully - ${userId}!`,
          });
        })
        .catch((error) => {
          console.error(`Error updating document: ${error}`);
          res.status(500).json({ success: false, error: `Error updating document: ${userId}` });
        });
    } catch (error) {
      console.error("Error encrypting data:", error);
      res.status(500).json({ success: false, error: "An error occurred during the process" });
    }
  }
});

// Endpoint to update the margin, percentage, option, preferred exchange, and enabled status of a specific worker of a specific plan of a specific user
app.post("/updateMargin", async (req, res) => {
  // Extract the user ID from the x-forwarded-authorization header of the incoming request
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  // Extract the product ID, worker ID, margin, percentage, option, preferred exchange, and enabled status from the body of the incoming request
  const { plan_id, worker_id, margin, percentage, option, preferred_exchange, enabled } = req.body;

  try {
    // Fetch the user document from Firestore
    const userDoc = await db.collection("users").doc(userId).get();

    // Check if the user document exists
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Create a reference to the worker document in the workers subcollection of the plan document in the plans subcollection of the user document
    const workerDocRef = db.collection(`users/${userId}/plans/${plan_id}/workers`).doc(worker_id);

    // Fetch the worker document that the workerDocRef points to
    const workerDoc = await workerDocRef.get();

    // Check if the worker document exists
    if (!workerDoc.exists) {
      return res.status(404).json({ success: false, error: "Worker not found for this user and worker id" });
    }

    // Prepare an object with the fields to update in the worker document
    const updateFields = {};

    // Check if each field is not empty or null before adding it to the updateFields object
    if (margin !== "" && margin !== null) {
      updateFields.margin = margin;
    }

    if (percentage !== "" && percentage !== null) {
      updateFields.percentage = percentage;
    }

    if (option !== "" && option !== null) {
      updateFields.option = option;
    }

    // Convert the preferred_exchange field to lowercase before adding it to the updateFields object
    if (preferred_exchange !== "" && preferred_exchange !== null) {
      updateFields.preferred_exchange = preferred_exchange.toLowerCase();
    }

    // If the enabled field is a boolean, add it to the updateFields object
    if (typeof enabled === "boolean") {
      updateFields.enabled = enabled;
    }

    // Update the worker document with the fields in the updateFields object
    await workerDocRef.update(updateFields);

    // Send a JSON response indicating that the operation was successful
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
});

app.get("/exchanges", async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  try {
    const documentSnapshot = await db.collection("users").doc(userId).get();

    if (!documentSnapshot.exists) {
      res.status(404).json({ success: false, error: "User not found for exchanges" });
      return;
    }

    const traderData = documentSnapshot.data();

    // Extracting exchange APIs with valid keys and secrets
    const existingApis = {};
    for (const exchange in traderData.exchanges) {
      const { api_key, api_secret } = traderData.exchanges[exchange];
      if (api_key && api_key !== "x" && api_secret && api_secret !== "x") {
        existingApis[exchange] = true;
      } else {
        existingApis[exchange] = false;
      }
    }

    const responseData = {
      success: true,
      existingApis,
      socials: {
        telegram: traderData.telegram,
        discord: traderData.discord,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.log("Error retrieving user data:", error);
    res.status(500).json({ success: false, error: "Error retrieving user data" });
  }
});

// Endpoint to get all plans and their associated workers for a specific user
app.get("/plans", async (req, res) => {
  // Extract the user ID from the x-forwarded-authorization header of the incoming request
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  try {
    // Create a reference to the document in the users collection that has the ID equal to userId
    const userRef = db.collection("users").doc(userId);
    // Fetch the document that the userRef points to
    const userSnapshot = await userRef.get();

    // Check if the user document exists
    if (!userSnapshot.exists) {
      res.status(404).json({ success: false, error: "User not found for plans" });
      return;
    }

    // Create a reference to the plans subcollection of the user document
    const plansRef = userRef.collection("plans");
    // Fetch all the documents in the plans subcollection
    const plansSnapshot = await plansRef.get();

    // Extract the data from the plans documents
    const plansData = [];
    for (const doc of plansSnapshot.docs) {
      if (doc.exists) {
        const planData = doc.data();
        // Create a reference to the workers subcollection of the current plan document
        const workersRef = plansRef.doc(doc.id).collection("workers");
        // Fetch all the documents in the workers subcollection of the current plan document
        const workersSnapshot = await workersRef.get();
        const workersData = [];
        for (const workerDoc of workersSnapshot.docs) {
          if (workerDoc.exists) {
            const workerData = workerDoc.data();
            // Add the ID of the worker document to the worker data
            workerData.id = workerDoc.id;
            workersData.push(workerData);
          }
        }
        // Add the array of worker data to the plan data
        planData.workers = workersData;
        // Add the plan data (which now includes the worker data) to the array of all plan data
        plansData.push(planData);
      }
    }

    // Prepare the response data
    const responseData = {
      success: true,
      plans: plansData,
    };

    // Send the response data as JSON
    res.json(responseData);
  } catch (error) {
    // Log any error that occurred and send a 500 response
    console.log("Error retrieving plans:", error);
    res.status(500).json({ success: false, error: "Error retrieving plans" });
  }
});

app.get("/pubKey", async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  try {
    if (!userId) {
      return res.status(400).json({ success: false, error: "User name is missing" });
    }

    const userSnapshot = await db.collection("users").doc(userId).get();

    if (!userSnapshot.exists) {
      res.status(404).json({ success: false, error: "User not found for pubKey" });
      return;
    }

    const publicKey = await getPublicKey(userId);

    if (publicKey) {
      res.status(200).json({ success: true, publicKey });
    } else {
      res.status(404).json({ success: false, error: "Public key not found." });
    }
  } catch (error) {
    // Catch any error that occurred while getting the public key
    console.log(error);
    res.status(500).json({ success: false, error: "An error occurred while getting the public key." });
  }
});

// Second1 Delete:
app.delete("/deleteExchange", async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  const exchangeName = req.body.exchange.toLowerCase();

  try {
    const userRef = db.collection("users").doc(userId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      res.status(404).json({ success: false, error: "User not found for delete exchange" });
      return;
    }

    const userData = userSnapshot.data();
    const exchanges = userData.exchanges;

    if (!exchanges.hasOwnProperty(exchangeName)) {
      res.status(404).json({ success: false, error: "Exchange not found" });
      return;
    }

    // Delete API credentials by setting them to 'x'
    exchanges[exchangeName].api_key = "x";
    exchanges[exchangeName].api_secret = "x";
    if (exchanges[exchangeName].api_passphrase) {
      exchanges[exchangeName].api_passphrase = "x";
    }

    await userRef.update({ exchanges });

    res.json({ success: true, message: "Exchange credentials deleted successfully" });
  } catch (error) {
    console.error("Error deleting exchange credentials:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

// expose the express app as a cloud function
module.exports = {
  member: app,
};
