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
    res
      .status(400)
      .json({ success: false, error: `api_passphrase is required for ${exchange} exchange` });
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

app.post("/updateMargin", async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  // license_key can be replaced by product id as its more fitting. Would just need to also adjust
  // the query snapshot to use product id instead of license key
  const { license_key, margin, percentage, option, preferred_exchange, worker_id } = req.body;

  try {
    // Get user document from Firestore
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Get plan document that matches the license key
    const plansCollectionRef = db.collection(`users/${userId}/plans`);
    const planQuerySnapshot = await plansCollectionRef.where("license", "==", license_key).get();

    if (planQuerySnapshot.empty) {
      return res
        .status(404)
        .json({ success: false, error: "Plan not found for this user and license key" });
    }

    // Get worker document
    const planDocRef = planQuerySnapshot.docs[0].ref;
    const workerDocRef = planDocRef.collection("workers").doc(worker_id);

    // Update worker document with new margin, percentage, option, preferred_exchange values
    const updateFields = {};

    if (margin !== "" && margin !== null) {
      updateFields.margin = margin;
    }

    if (percentage !== "" && percentage !== null) {
      updateFields.percentage = percentage;
    }

    if (option !== "" && option !== null) {
      updateFields.option = option;
    }

    if (preferred_exchange !== "" && preferred_exchange !== null) {
      updateFields.preferred_exchange = preferred_exchange.toLowerCase();
    }

    await workerDocRef.update(updateFields);

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

app.get("/plans", async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1];

  try {
    // Get the user document
    const userRef = db.collection("users").doc(userId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      res.status(404).json({ success: false, error: "User not found for plans" });
      return;
    }

    // Get the plans subcollection
    const plansRef = userRef.collection("plans");
    const plansSnapshot = await plansRef.get();

    // Extract the data from the plans documents
    const plansData = [];
    for (const doc of plansSnapshot.docs) {
      if (doc.exists) {
        const planData = doc.data();
        const workersRef = plansRef.doc(doc.id).collection("workers");
        const workersSnapshot = await workersRef.get();
        const workersData = [];
        for (const workerDoc of workersSnapshot.docs) {
          if (workerDoc.exists) {
            const workerData = workerDoc.data();
            workerData.id = workerDoc.id; // Add the worker ID to the data
            workersData.push(workerData);
          }
        }
        planData.workers = workersData; // Add the workers data to the plan data
        plansData.push(planData);
      }
    }

    // example response data:
    // {
    //   "success": true,
    //   "plans": [
    //     {
    //       "product": "{product_id}",
    //       "product_name": "{product_name}",
    //       "license": "{license}",
    //       "account_id": "{account_id}",
    //       "workers": [
    //         {
    //           "id": "{worker_id}",
    //           "name": "{worker_name}",
    //           "margin": "{margin}",
    //           "percentage": "{percentage}",
    //           "option": "{option}",
    //           "preferred_exchange": "{preferred_exchange}",
    //           "enabled": {enabled}
    //         },
    //         // ... more workers
    //       ]
    //     },
    //     // ... more plans
    //   ]
    // }

    const responseData = {
      success: true,
      plans: plansData,
    };

    res.json(responseData);
  } catch (error) {
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
    res
      .status(500)
      .json({ success: false, error: "An error occurred while getting the public key." });
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
