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
    const plan_id = userbody["data"]["plan"]["id"];
    const plan_name = userbody["data"]["plan"]["metadata"]["plan_name"];
    const group_id = userbody["data"]["plan"]["metadata"]["group_id"];
    const license = userbody["data"]["license_key"];

    // Fetch the group document from the Firestore groups collection
    const groupsRef = db.collection("groups");

    // Find the group document with the matching group_id from the request body
    const groupSnapshot = await groupsRef.doc(group_id).get();

    // Validate the group document
    if (!groupSnapshot.exists) {
      console.log("No group found for group_id:", group_id);
      return res.status(404).send(JSON.stringify({ error: "Group not found" }));
    }

    // Fetch the plan document from the Firestore plans collection
    const planRef = groupSnapshot.ref.collection("plans").doc(plan_id);
    const planSnapshot = await planRef.get();

    // Validate the plan document
    if (!planSnapshot.exists) {
      console.log("No plan found for plan_id:", plan_id);
      return res.status(404).send(JSON.stringify({ error: "Plan not found" }));
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

    // For each worker in the plan, create a new document in the plans subcollection
    const workersRef = planSnapshot.ref.collection("assigned_workers");
    const workersSnapshot = await workersRef.get();

    for (const doc of workersSnapshot.docs) {
      const worker = doc.data();
      // Initialize worker data
      worker.enabled = false; // Initialize as disabled
      worker.margin = "x"; // Initialize as "x"
      worker.percentage = "x"; // Initialize as "x"
      worker.option = "x"; // Initialize as "x"
      worker.preferred_exchange = "x"; // Initialize as "x"
      worker.plan_id = plan_id;

      // Create a new plan document in the plans subcollection
      const userPlanRef = await userRef.collection("plans").doc(plan_id);
      plandata.plan_id = plan_id;
      plandata.plan_name = plan_name;
      plandata.license = license;
      plandata.account_id = account_id;
      await userPlanRef.set(plandata);
      // Create a new worker document in the workers subcollection
      await userPlanRef.collection("workers").doc(worker.id).set(worker);
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
//     // Extract user data from the request body
//     let userbody = req.body;

//     // Validate the action in the request body
//     if (userbody["action"] !== "membership.went_valid") {
//       return res.status(400).send(JSON.stringify({ error: "Invalid action" }));
//     }

//     // Extract data from the request body
//     const user = userbody["data"]["user"]["id"];
//     const account_id = userbody["data"]["id"];
//     const product_id = userbody["data"]["product"]["id"];
//     const product_name = userbody["data"]["product"]["name"];
//     const license = userbody["data"]["license_key"];

//     // Fetch the product document from the Firestore products collection
//     const productsRef = db.collection("products");

//     // Find the product document with the matching product_id from the request body
//     const productSnapshot = await productsRef.doc(product_id).get();

//     // Validate the product document
//     if (!productSnapshot.exists) {
//       console.log("No product found for product_id:", product_id);
//       return res.status(404).send(JSON.stringify({ error: "Product not found" }));
//     }

//     // Fetch the user document from the Firestore users collection
//     const userRef = db.collection("users").doc(user);
//     const userSnapshot = await userRef.get();

//     // If the user document does not exist, create a new user document
//     if (!userSnapshot.exists) {
//       userdata.account = user;
//       await userRef.set(userdata);
//       await createUserKey(user);
//     }

//     // For each worker in the product, create a new document in the plans subcollection
//     const workersRef = productSnapshot.ref.collection("workers");
//     const workersSnapshot = await workersRef.get();

//     for (const doc of workersSnapshot.docs) {
//       const worker = doc.data();
//       // Initialize worker data
//       worker.enabled = false; // Initialize as disabled
//       worker.margin = "x"; // Initialize as "x"
//       worker.percentage = "x"; // Initialize as "x"
//       worker.option = "x"; // Initialize as "x"
//       worker.preferred_exchange = "x"; // Initialize as "x"
//       worker.product_id = product_id;

//       // Create a new plan document in the plans subcollection
//       const planRef = await userRef.collection("plans").doc(product_id);
//       plandata.product_id = product_id;
//       plandata.product_name = product_name;
//       plandata.license = license;
//       plandata.account_id = account_id;
//       await planRef.set(plandata);
//       // Create a new worker document in the workers subcollection
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

app.post("/updateLicense", async (req, res) => {
  const { userId, productId } = req.body;

  try {
    // Get the product document reference
    const productDocRef = db.collection("products").doc(productId);

    // Fetch the product document
    const productDoc = await productDocRef.get();

    if (!productDoc.exists) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Get the workers in the product
    const productWorkersRef = productDocRef.collection("workers");
    const productWorkersSnapshot = await productWorkersRef.get();
    const productWorkers = productWorkersSnapshot.docs.map((doc) => doc.data());

    // Get the user's plan document reference
    const planDocRef = db.collection(`users/${userId}/plans`).doc(productId);

    // Fetch the user's plan document
    const planDoc = await planDocRef.get();

    if (!planDoc.exists) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Get the workers in the user's plan
    const planWorkersRef = planDocRef.collection("workers");
    const planWorkersSnapshot = await planWorkersRef.get();
    const planWorkers = planWorkersSnapshot.docs.map((doc) => doc.data());

    // For each worker in the product
    for (const worker of productWorkers) {
      // If the worker is not in the user's plan, add it
      if (!planWorkers.some((planWorker) => planWorker.id === worker.id)) {
        const newWorker = {
          enabled: false,
          id: worker.id,
          margin: "x",
          name: worker.name,
          option: "x",
          percentage: "x",
          preferred_exchange: "x",
          product_id: productId,
        };
        await planWorkersRef.doc(worker.id).set(newWorker);
      }
    }

    // For each worker in the user's plan
    for (const worker of planWorkers) {
      // If the worker is not in the product, remove it
      if (!productWorkers.some((productWorker) => productWorker.id === worker.id)) {
        await planWorkersRef.doc(worker.id).delete();
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Something went wrong" });
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
