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
  const wh = new Webhook(process.env.CREATE_GROUP_SECRET);

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

app.post("/addWorkerToGroup", async (req, res) => {
  let payload = JSON.stringify(req.body);
  const wh = new Webhook(process.env.ADD_WORKER_SECRET);

  const headers_svix = {
    "svix-id": String(req.get("svix-id")),
    "svix-timestamp": String(req.get("svix-timestamp")),
    "svix-signature": String(req.get("svix-signature")),
  };

  let organizationMembership;
  try {
    organizationMembership = wh.verify(payload, headers_svix);
  } catch (err) {
    console.log(err);
    res.status(400).json({});
    return;
  }

  const groupRef = firestore.collection("groups").doc(organizationMembership.data.organization.id);
  const workersRef = groupRef.collection("workers");

  // first_name is null if the user does not use a social connection to sign up and the username is not provided
  // here we are adding a backup name to the worker in preparation for adding to group by fetching
  // the username from the traders collection
  // this is because the user.created DOES include the username but the organizationMember.created does not
  // which is the one that hits this endpoint.
  let name = organizationMembership.data.public_user_data.first_name;
  if (!name) {
    // Fetch the username from the traders collection if first_name is not provided
    const traderDoc = await firestore
      .collection("traders")
      .doc(organizationMembership.data.public_user_data.user_id)
      .get();
    if (traderDoc.exists) {
      name = traderDoc.data().trader_name;
    } else {
      console.error("Unable to add a backup name to worker in preparation for adding to group");
      name = "Unknown";
    }
  }

  try {
    await workersRef.doc(organizationMembership.data.public_user_data.user_id).set({
      id: organizationMembership.data.public_user_data.user_id,
      email: organizationMembership.data.public_user_data.identifier,
      name: name,
    });
    console.log("Worker added to group");
    res.status(200).send("Worker added to group");
  } catch (error) {
    console.error("Error adding worker to group", error);
    res.status(500).send("Error adding worker to group");
    return;
  }
});

exports.clerkWebhook = app;
