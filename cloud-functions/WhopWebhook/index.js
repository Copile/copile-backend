const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const { createUserKey, deleteExchangeKey } = require("./encryption");
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));

// default user data object
const userdata = {
  account: "",
  exchanges: {
    bybit: {
      api_key: "x",
      api_secret: "x",
    },
    kucoin: {
      api_key: "x",
      api_secret: "x",
      api_passphrase: "x",
    },
    binance: {
      api_key: "x",
      api_secret: "x",
    },
    bingx: {
      api_key: "x",
      api_secret: "x",
    },
  },
  telegram: {
    id: "x",
  },
  discord: {
    id: "x",
  },
};

// default plan data object
const plandata = {
  product_id: "",
  product_name: "",
  license: "",
  account_id: "",
};

// Async function to delete a document and its subcollections
async function deleteDocumentAndSubcollections(documentRef) {
  // Get all subcollections of the document
  const subcollections = await documentRef.listCollections();

  // Delete all documents within the subcollections
  const deletePromises = subcollections.map(async (subcollection) => {
    const docs = await subcollection.listDocuments();
    return Promise.all(docs.map((doc) => doc.delete()));
  });

  // Wait for all subcollections to be deleted
  await Promise.all(deletePromises);

  // Delete the document
  await documentRef.delete();
}

app.post("/createLicense", async (req, res) => {
  try {
    // Extract user data from the request body
    let userbody = req.body;

    // Validate the action in the request body
    if (userbody["action"] !== "membership.went_valid") {
      return res.status(400).send(JSON.stringify({ error: "Invalid action" }));
    }

    // Extract data from the request body
    const user = userbody["data"]["user"]["id"];
    const account_id = userbody["data"]["id"];
    const product_id = userbody["data"]["product"]["id"];
    const product_name = userbody["data"]["product"]["name"];
    const license = userbody["data"]["license_key"];

    // Fetch the product document from the Firestore products collection
    const productsRef = db.collection("products");

    // Find the product document with the matching product_id from the request body
    const productSnapshot = await productsRef.doc(product_id).get();

    // Validate the product document
    if (!productSnapshot.exists) {
      console.log("No product found for product_id:", product_id);
      return res.status(404).send(JSON.stringify({ error: "Product not found" }));
    }

    // Fetch the user document from the Firestore users collection
    const userRef = db.collection("users").doc(user);
    const userSnapshot = await userRef.get();

    // If the user document does not exist, create a new user document
    if (!userSnapshot.exists) {
      userdata.account = user;
      await userRef.set(userdata);
      await createUserKey(user);
    }

    // For each worker in the product, create a new document in the plans subcollection
    const workersRef = productSnapshot.ref.collection("workers");
    const workersSnapshot = await workersRef.get();

    for (const doc of workersSnapshot.docs) {
      const worker = doc.data();
      // Initialize worker data
      worker.enabled = false; // Initialize as disabled
      worker.margin = "x"; // Initialize as "x"
      worker.percentage = "x"; // Initialize as "x"
      worker.option = "x"; // Initialize as "x"
      worker.preferred_exchange = "x"; // Initialize as "x"
      worker.product_id = product_id;

      // Create a new plan document in the plans subcollection
      const planRef = await userRef.collection("plans").doc(product_id);
      plandata.product_id = product_id;
      plandata.product_name = product_name;
      plandata.license = license;
      plandata.account_id = account_id;
      await planRef.set(plandata);
      // Create a new worker document in the workers subcollection
      await planRef.collection("workers").doc(worker.id).set(worker);
    }

    console.log("Created user with the id: " + user);
    return res.send(JSON.stringify({ status: 200 }));
  } catch (error) {
    console.log(error);
    return res.status(500).send(JSON.stringify({ error: "Internal server error" }));
  }
});

// app.post("/createLicense", async (req, res) => {
//   try {
//     let userbody = req.body;

//     if (userbody["action"] !== "membership.went_valid") {
//       return res.status(400).send(JSON.stringify({ error: "Invalid action" }));
//     }

//     const user = userbody["data"]["user"]["id"];
//     const account_id = userbody["data"]["id"];
//     const product_id = userbody["data"]["product"]["id"];
//     const product_name = userbody["data"]["product"]["name"];
//     const license = userbody["data"]["license_key"];

//     // Fetch the group from Firestore
//     const groupsRef = db.collection("groups");
//     const groupSnapshot = await groupsRef.where("products", "array-contains", product_id).get();

//     if (groupSnapshot.empty) {
//       console.log("No group found for product_id:", product_id);
//       return res.status(404).send(JSON.stringify({ error: "Group not found" }));
//     }

//     const productRef = groupSnapshot.docs[0].ref.collection("products").doc(product_id);
//     const productSnapshot = await productRef.get();

//     if (!productSnapshot.exists) {
//       console.log("No product found for product_id:", product_id);
//       return res.status(404).send(JSON.stringify({ error: "Product not found" }));
//     }

//     const userRef = db.collection("users").doc(user);
//     const userSnapshot = await userRef.get();

//     if (!userSnapshot.exists) {
//       // User does not exist, create a new user document
//       userdata.account = user;
//       await userRef.set(userdata);
//       await createUserKey(user);
//     }

//     // For each worker in the product, create a new document in the plans subcollection
//     const workersRef = productRef.collection("workers");
//     const workersSnapshot = await workersRef.get();

//     for (const doc of workersSnapshot.docs) {
//       const worker = doc.data();
//       worker.enabled = false; // Initialize as disabled
//       worker.margin = "x"; // Initialize as "x"
//       worker.percentage = "x"; // Initialize as "x"
//       worker.option = "x"; // Initialize as "x"
//       worker.preferred_exchange = "x"; // Initialize as "x"
//       worker.product_id = product_id;

//       const planRef = await userRef.collection("plans").doc(product_id);
//       plandata.product_id = product_id;
//       plandata.product_name = product_name;
//       plandata.license = license;
//       plandata.account_id = account_id;
//       await planRef.set(plandata);
//       await planRef.collection("workers").doc(worker.id).set(worker);
//     }

//     console.log("Created user with the id: " + user);
//     return res.send(JSON.stringify({ status: 200 }));
//   } catch (error) {
//     console.log(error);
//     return res.status(500).send(JSON.stringify({ error: "Internal server error" }));
//   }
// });

// In this adjusted code, when a user's membership becomes invalid, the webhook deletes the product
// and its workers from the user's plans. If the user has no other plans, the user is also deleted.

app.post("/deleteLicense", async (req, res) => {
  try {
    let userbody = req.body;
    if (userbody["action"] == "membership.went_invalid") {
      const user = userbody["data"]["user"]["id"];
      const product = userbody["data"]["product"]["id"];

      const userRef = db.collection("users").doc(user);
      const productRef = userRef.collection("plans").doc(product);

      // Delete the product and its workers
      await deleteDocumentAndSubcollections(productRef);

      // Check if the user has any other plans
      const plansSnapshot = await userRef.collection("plans").get();
      if (plansSnapshot.empty) {
        // If the user has no other plans, delete the user
        await deleteDocumentAndSubcollections(userRef);
      }

      return res.send(JSON.stringify({ status: 200 }));
    } else {
      throw new Error("Invalid action specified in request");
    }
  } catch (error) {
    console.log(error);
    return res.status(500).send(JSON.stringify({ error: "Internal server error" }));
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
  createLicense: app,
};
