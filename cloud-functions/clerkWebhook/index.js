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
  console.log("Payload: ", payload);
  const wh = new Webhook(process.env.ADD_WORKER_SECRET);

  const headers_svix = {
    "svix-id": String(req.get("svix-id")),
    "svix-timestamp": String(req.get("svix-timestamp")),
    "svix-signature": String(req.get("svix-signature")),
  };
  console.log("Headers: ", headers_svix);

  let organizationMembership;
  try {
    organizationMembership = wh.verify(payload, headers_svix);
    console.log("Organization Membership: ", organizationMembership);
  } catch (err) {
    console.log("Error verifying payload: ", err);
    res.status(400).json({});
    return;
  }

  const groupRef = firestore.collection("groups").doc(organizationMembership.data.organization.id);
  const workersRef = groupRef.collection("workers");

  // first_name is null if the user does not use a social connection to sign up and the username is not provided period.
  // Here we are adding a backup name to the worker in preparation for adding to group by fetching
  // the username from the traders collection where its been provided by the user.created webhook.
  // This is because the user.created DOES include the username but the organizationMember.created does not
  // which is the one that hits this endpoint.
  // We are also going to have to do this for identifier (email) because it is sometimes an empty string in the organizationMember.created webhook.
  // However more testing is needed
  let name = organizationMembership.data.public_user_data.first_name;
  let email = organizationMembership.data.public_user_data.identifier;
  console.log("Initial Name: ", name);

  if (!name || !email) {
    // Fetch the username and email from the traders collection if first_name or identifier is not provided
    const traderDoc = await firestore
      .collection("traders")
      .doc(organizationMembership.data.public_user_data.user_id)
      .get();
    if (traderDoc.exists) {
      name = name || traderDoc.data().trader_name;
      email = email || traderDoc.data().email;
      console.log("Fetched Name: ", name);
      console.log("Fetched Email: ", email);
    } else {
      console.error("Unable to add a backup name or email to worker in preparation for adding to group");
      name = name || "Unknown";
      email = email || "Unknown";
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
