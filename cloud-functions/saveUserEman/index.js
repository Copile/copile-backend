const Webhook = require("svix").Webhook;
const express = require("express");
const applyMiddleware = require("./middleware");
const { createUserKey } = require("./encryption");
const bodyParser = require("body-parser");
const app = express();
applyMiddleware(app);

const { Firestore } = require("@google-cloud/firestore");
const firestore = new Firestore();

app.use(bodyParser.text({ type: "application/json" }));

app.post("/saveUserEman", async (req, res) => {
  let payload = JSON.stringify(req.body);
  const wh = new Webhook(process.env.secret);

  const headers_svix = {
    "svix-id": String(req.get("svix-id")),
    "svix-timestamp": String(req.get("svix-timestamp")),
    "svix-signature": String(req.get("svix-signature")),
  };

  let user;
  try {
    user = wh.verify(payload, headers_svix);
  } catch (err) {
    console.log(err);
    res.status(400).json({});
    return; // Add this
  }

  const tradersRef = firestore.collection("traders");

  try {
    const primaryEmail = user.data.email_addresses.find(
      (email) => email.id === user.data.primary_email_address_id
    );
    const email = primaryEmail.email_address || email_addresses[0].email_address || "unknown";

    await tradersRef.doc(user.data.id).set({
      trader_id: user.data.id,
      trader_name: user.data.username,
      trader_email: email,
      // Add any other user data you want to save to Firestore
    });
    const keycreation = await createUserKey(user.data.id);
    console.log("User saved to Firestore");
    res.status(200).send("User saved to Firestore");
  } catch (error) {
    console.error("Error saving user to Firestore", error);
    res.status(500).send("Error saving user to Firestore");
    return; // Add this
  }
});

exports.saveUserEman = app;
