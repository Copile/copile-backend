const Firestore = require('@google-cloud/firestore')
const db = new Firestore
const { createUserKey, deleteExchangeKey } = require('./encryption')
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));

// default user data object
const userdata = {
    'account': "",
    'exchanges': {
        'bybit': {
            "api_key": "x",
            "api_secret": "x",
        },
        'kucoin': {
            "api_key": "x",
            "api_secret": "x",
            "api_passphrase": "x",
        },
        'binance': {
            "api_key": "x",
            "api_secret": "x",
        },
        'bingx': {
            "api_key": "x",
            "api_secret": "x"
        }
    },
    "telegram": "x",
    "discord": "x"
}

// default plan data object
const plandata = {
    'product': "",
    'license': "",
    'account_id': "",
    'margin': 'x',
    'percentage': 'x',
    'option': 'x',
    'preferred_exchange': "x"
}

// Async function to delete a document and its subcollections
async function deleteDocumentAndSubcollections(documentRef) {
  // Get all subcollections of the document
  const subcollections = await documentRef.listCollections();

  // Delete all documents within the subcollections
  const deletePromises = subcollections.map(async subcollection => {
    const docs = await subcollection.listDocuments();
    return Promise.all(docs.map(doc => doc.delete()));
  });

  // Wait for all subcollections to be deleted
  await Promise.all(deletePromises);

  // Delete the document
  await documentRef.delete();
}

// Route to create license
app.post("/createLicense", async (req, res) => {
    try {
        let userbody = req.body;
        
        if (userbody['action'] !== "membership.went_valid") {
            return res.status(400).send(JSON.stringify({ error: "Invalid action" }));
        }

        const user = userbody['data']['user']['id'];
        const account_id = userbody['data']['id'];
        const product = userbody['data']['product']['id'];
        const product_name = userbody['data']['product']['name']
        const plan = userbody['data']['plan']['id'];
        const license = userbody['data']['license_key'];

        const userRef = db.collection('users').doc(user);
        const userSnapshot = await userRef.get();

        if (userSnapshot.exists) {
            plandata.product = product;
            plandata.license = license;
            plandata.product_name = product_name;
            plandata.account_id = account_id;
            await userRef.collection('plans').doc(product).set(plandata);
            console.log("Added product for the user with the id: " + user);
        } else {
            userdata.account = user;
            plandata.product = product;
            plandata.product_name = product_name
            plandata.license = license;
            plandata.account_id = account_id;
            
            await userRef.set(userdata);
            await userRef.collection('plans').doc(product).set(plandata);
            await createUserKey(user);
            console.log("Created user with the id: " + user);
        }
        return res.send(JSON.stringify({ status: 200 }));
    } catch (error) {
        console.log(error);
        return res.status(500).send(JSON.stringify({ error: "Internal server error" }));
    }
});

// Route to delete license
app.post("/deleteLicense", async (req, res) => {
    try {
        let userbody = req.body;
        let plans = [];
        if (userbody["action"] == "membership.went_invalid") {
        const user = userbody["data"]["user"]["id"];
        const plan = userbody['data']['plan']['id'];
        const product = userbody['data']['product']['id'];
        const query = db.collection("users").doc(user).collection("plans");
        const snapshot = await query.get();
        snapshot.forEach((doc) => {
            plan_id = doc.id;
            plans.push(plan_id);
        });
        if (plans.length === 1) {
            const documentRef = db.collection("users").doc(user);
            await deleteDocumentAndSubcollections(documentRef);
        } else {
            const delete_plan = db
            .collection("users")
            .doc(user)
            .collection("plans")
            .doc(product)
            .delete();
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
})

app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    createLicense: app
}