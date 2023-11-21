const Webhook = require("svix").Webhook;
const express = require("express");
const applyMiddleware = require("./middleware");
const bodyParser = require("body-parser");
const app = express();
applyMiddleware(app);

const { Firestore } = require("@google-cloud/firestore");
const firestore = new Firestore();

app.use(bodyParser.text({ type: "application/json" }));

app.post("/createGroup", async (req, res) => {
  let payload = JSON.stringify(req.body);
  const wh = new Webhook(process.env.secret);

  const headers_svix = {
    "svix-id": String(req.get("svix-id")),
    "svix-timestamp": String(req.get("svix-timestamp")),
    "svix-signature": String(req.get("svix-signature")),
  };

  let organization;
  try {
    organization = wh.verify(payload, headers_svix);
  } catch (err) {
    console.log(err);
    res.status(400).json({});
    return;
  }

  const groupsRef = firestore.collection("groups");

  try {
    await groupsRef.doc(organization.data.id).set({
      org_id: organization.data.id,
      created_by: organization.data.created_by,
      created_at: organization.data.created_at,
      image_url: organization.data.image_url,
      logo_url: organization.data.logo_url,
      name: organization.data.name,
      object: organization.data.object,
      public_metadata: organization.data.public_metadata,
      slug: organization.data.slug,
      updated_at: organization.data.updated_at,
    });
    console.log("Organization saved to Firestore");
    res.status(200).send("Organization saved to Firestore");
  } catch (error) {
    console.error("Error saving organization to Firestore", error);
    res.status(500).send("Error saving organization to Firestore");
    return;
  }
});

exports.clerkWebhook = app;
