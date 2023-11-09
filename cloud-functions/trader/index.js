const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const { getPublicKey } = require("./encryption");

const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

const WHOP_TOKEN = process.env.whopToken;
const request = require("request");

const getMonthYear = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return `${date.toLocaleString("en-us", { month: "long" })} ${date.getFullYear()}`;
};

const deleteWhopmember = (mem_id) => {
  return new Promise((resolve, reject) => {
    request(
      {
        url: `https://api.whop.com/api/v2/memberships/${mem_id}/terminate`,
        method: "POST",
        headers: {
          Authorization: "Bearer " + WHOP_TOKEN,
        },
        json: true,
      },
      (err, resp, body) => {
        if (err) {
          reject(err);
        } else if (resp.statusCode !== 200) {
          reject(new Error(`HTTP error ${resp.statusCode}: ${JSON.stringify(body)}`));
        } else {
          resolve(body);
        }
      }
    );
  });
};

const createWhopPlan = (planData) => {
  return new Promise((resolve, reject) => {
    request(
      {
        url: "https://api.whop.com/api/v2/plans",
        method: "POST",
        headers: {
          Authorization: "Bearer " + WHOP_TOKEN,
        },
        body: planData,
        json: true,
      },
      (error, response, body) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Whop API response: ${JSON.stringify(body)}`);
          resolve(body);
        }
      }
    );
  });
};

app.post("/create-plan", async (req, res) => {
  const planData = req.body;

  try {
    const whopPlan = await createWhopPlan(planData);
    const { id, product, renewal_price, initial_price, base_currency, direct_link } = whopPlan;

    const traderId = req.body.trader_id;
    const traderRef = db.collection("traders").doc(traderId);
    const productsRef = traderRef.collection("products").doc(id);

    const newProduct = {
      id,
      product,
      renewal_price,
      initial_price,
      currency: base_currency,
      quick_link: direct_link,
    };

    await productsRef.set(newProduct);

    res.json(newProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create plan" });
  }
});

app.post("/terminatemember", async (req, res) => {
  const { mem_id } = req.body;

  try {
    const response = await deleteWhopmember(mem_id);
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/:traderID/members", async (req, res) => {
  try {
    const traderID = req.params.traderID;

    const membersSnapshot = await db
      .collection("traders")
      .doc(traderID)
      .collection("products")
      .get();

    const getPlanMembers = async (planID) => {
      const planSnapshot = await db
        .collection("traders")
        .doc(traderID)
        .collection("products")
        .doc(planID)
        .collection("members")
        .get();

      const members = [];
      planSnapshot.docs.forEach((memberDoc) => {
        const member = memberDoc.data();
        members.push(member);
      });

      return members;
    };

    const getAllPlanMembersPromises = membersSnapshot.docs.map((doc) => getPlanMembers(doc.id));

    const allPlanMembers = await Promise.all(getAllPlanMembersPromises);

    const members = allPlanMembers.reduce((acc, planMembers) => {
      return [...acc, ...planMembers];
    }, []);

    res.status(200).json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Endpoint to get all sales of a trader
app.get("/:traderID/sales", async (req, res) => {
  const traderID = req.params.traderID;

  try {
    const productsSnapshot = await db
      .collection("traders")
      .doc(traderID)
      .collection("products")
      .get();

    const getPlanSales = async (planID) => {
      const salesSnapshot = await db
        .collection("traders")
        .doc(traderID)
        .collection("products")
        .doc(planID)
        .collection("sales")
        .get();

      const sales = [];
      salesSnapshot.forEach((saleDoc) => {
        const sale = saleDoc.data();

        sales.push(sale);
      });

      return sales;
    };

    const getAllPlanSalesPromises = productsSnapshot.docs.map((doc) => getPlanSales(doc.id));

    const allPlanSales = await Promise.all(getAllPlanSalesPromises);

    const sales = allPlanSales.flat();

    res.status(200).json(sales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve sales data" });
  }
});

app.post("/updateExchange", async (req, res) => {
  const traderId = req.get("traderId");
  const request_exchange = req.body.exchange;
  const exchange = request_exchange.toLowerCase();
  const read_only = req.body.is_monitor;
  const api_key = req.body.api_key;
  const api_secret = req.body.api_secret;
  const api_passphrase = req.body.api_passphrase;
  const userRef = db.collection("traders").doc(traderId);

  // check if api_passphrase is required
  if (exchange === "kucoin" && !api_passphrase) {
    res
      .status(400)
      .json({ success: false, error: `api_passphrase is required for ${exchange} exchange` });
  } else {
    try {
      const keyField = read_only ? "read_only_api_key" : "api_key"; // determine the key field based on read_only
      const secretField = read_only ? "read_only_api_secret" : "api_secret"; // determine the secret field based on read_only
      const passphraseField = read_only ? "read_only_api_passphrase" : "api_passphrase"; // determine the passphrase field based on read_only

      const updateFields = {
        [`exchanges.${exchange}.${keyField}`]: api_key,
        [`exchanges.${exchange}.${secretField}`]: api_secret,
      };

      if (exchange === "kucoin") {
        updateFields[`exchanges.${exchange}.${passphraseField}`] = api_passphrase;
      }

      userRef
        .update(updateFields)
        .then(() => {
          console.log(`Exchange information updated successfully - ${traderId}!`);
          res.status(200).json({
            success: true,
            message: `Exchange information updated successfully - ${traderId}!`,
          });
        })
        .catch((error) => {
          console.error(`Error updating document: ${error}`);
          res.status(500).json({ success: false, error: `Error updating document: ${traderId}` });
        });
    } catch (error) {
      console.error("Error encrypting data:", error);
      res.status(500).json({ success: false, error: "An error occurred during the process" });
    }
  }
});

app.post("/updateMonitorStatus", async (req, res) => {
  const traderId = req.get("traderId");
  const { isMonitorEnabled } = req.body;

  try {
    const traderRef = db.collection("traders").doc(traderId);
    const traderDocumentSnapshot = await traderRef.get();

    if (!traderDocumentSnapshot.exists) {
      res.status(404).json({ success: false, error: "Trader not found" });
      return;
    }

    await traderRef.update({ is_monitor_enabled: isMonitorEnabled });

    console.log(`Monitor status updated successfully - ${traderId}!`);
    res.status(200).json({
      success: true,
      message: `Monitor status updated successfully - ${traderId}!`,
    });
  } catch (error) {
    console.error(`Error updating document: ${error}`);
    res.status(500).json({ success: false, error: `Error updating document: ${traderId}` });
  }
});

app.get("/account", async (req, res) => {
  const traderId = req.get("traderId");

  console.log(traderId);

  try {
    const traderDocumentSnapshot = await db.collection("traders").doc(traderId).get();

    if (!traderDocumentSnapshot.exists) {
      res.status(404).json({ success: false, error: "Trader not found" });
      return;
    }

    const traderData = traderDocumentSnapshot.data();

    // Extracting exchange APIs with valid keys and secrets
    const existingApis = {};
    const existingReadOnlyApis = {};
    for (const exchange in traderData.exchanges) {
      const { api_key, api_secret, read_only_api_key, read_only_api_secret } =
        traderData.exchanges[exchange];

      if (api_key && api_key !== "x" && api_secret && api_secret !== "x") {
        existingApis[exchange] = true;
      } else {
        existingApis[exchange] = false;
      }

      if (
        read_only_api_key &&
        read_only_api_key !== "x" &&
        read_only_api_secret &&
        read_only_api_secret !== "x"
      ) {
        existingReadOnlyApis[exchange] = true;
      } else {
        existingReadOnlyApis[exchange] = false;
      }
    }

    // Fetch product IDs from the 'products' subcollection
    const productsCollectionSnapshot = await db
      .collection("traders")
      .doc(traderId)
      .collection("products")
      .get();
    const plans = productsCollectionSnapshot.docs.map((doc) => doc.data()); // fetch document data
    const responseData = {
      success: true,
      existingApis,
      existingReadOnlyApis,
      always_exchanges: traderData.always_exchanges,
      connected_discord: traderData.connected_discord,
      connected_telegram: traderData.connected_telegram,
      trader_name: traderData.trader_name,
      plans, // adding product plans to the response data
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error retrieving trader data:", error);
    res.status(500).json({ success: false, error: "Error retrieving trader data" });
  }
});

app.get("/pubKey", async (req, res) => {
  const traderId = req.get("traderId");

  try {
    if (!traderId) {
      return res.status(400).json({ success: false, error: "Trader name is missing" });
    }

    const traderDocumentSnapshot = await db.collection("traders").doc(traderId).get();

    if (!traderDocumentSnapshot.exists) {
      res.status(404).json({ success: false, error: "Trader not found" });
      return;
    }

    const publicKey = await getPublicKey(traderId);

    if (publicKey) {
      res.status(200).json({ success: true, publicKey });
    } else {
      res.status(404).json({ success: false, error: "Public key not found." });
    }
  } catch (error) {
    // Catch any error that occurred while getting the public key
    console.error(error);
    res.status(500).json({ error: "An error occurred while getting the public key." });
  }
});

app.put("/alwaysExchanges", async (req, res) => {
  const traderId = req.get("traderId");
  const { always_exchanges } = req.body;

  try {
    const documentRef = db.collection("traders").doc(traderId);
    const documentSnapshot = await documentRef.get();

    if (!documentSnapshot.exists) {
      res.status(404).json({ success: false, error: "Trader not found" });
      return;
    }

    // Use set() instead of update() to create the document if it doesn't exist
    await documentRef.set({ always_exchanges }, { merge: true });

    res.json({ success: true, message: "always_exchanges updated successfully" });
  } catch (error) {
    console.error("Error updating always_exchanges:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.delete("/deleteExchange", async (req, res) => {
  // Removed traderId from the route
  const traderId = req.get("traderId");
  const exchangeName = req.body.exchange.toLowerCase();
  const read_only = req.body.is_monitor;

  try {
    const documentRef = db.collection("traders").doc(traderId);
    const documentSnapshot = await documentRef.get();

    if (!documentSnapshot.exists) {
      res.status(404).json({ success: false, error: "Trader not found" });
      return;
    }

    const traderData = documentSnapshot.data();
    const exchanges = traderData.exchanges;

    if (!exchanges.hasOwnProperty(exchangeName)) {
      res.status(404).json({ success: false, error: "Exchange not found" });
      return;
    }

    // Determine the key and secret fields based on read_only
    const keyField = read_only ? "read_only_api_key" : "api_key";
    const secretField = read_only ? "read_only_api_secret" : "api_secret";
    const passphraseField = read_only ? "read_only_api_passphrase" : "api_passphrase"; // determine the passphrase field based on read_only

    // Delete API credentials by setting them to 'x'
    exchanges[exchangeName][keyField] = "x";
    exchanges[exchangeName][secretField] = "x";
    if (exchanges[exchangeName][passphraseField]) {
      exchanges[exchangeName][passphraseField] = "x";
    }

    await documentRef.update({ exchanges });

    res.json({ success: true, message: "Exchange credentials deleted successfully" });
  } catch (error) {
    console.error("Error deleting exchange credentials:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Copile Trader API");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

module.exports = {
  trader: app,
};
