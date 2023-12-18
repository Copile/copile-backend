const Webhook = require("svix").Webhook;
const express = require("express");
const applyMiddleware = require("./middleware");
const bodyParser = require("body-parser");
const { findAndSyncUsers } = require("./utils");
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

  // FIXME: Not working as expected. Need to figure out why.
  if (!name || !email) {
    // Fetch the username and email from the traders collection if first_name or identifier is not provided

    // The issue is, the user.created webhook may not resolve before the organizationMember.created webhook hits this endpoint
    // meaning if we try and get data from where the user.created is setting it, it may not be there yet.
    // So we need to wait for the user.created webhook to resolve before we can get the data from the traders collection, but we can't know when its done.
    // So we need to set a timeout and keep checking until the data is there. If it takes too long, we will just use a default value.
    // This is not ideal but it is the only way to do it.
    // We will set a timer of 2 seconds to check if the data is available. If it's not available after 6 seconds, we will give up and use default values.
    let attempts = 0;
    const maxAttempts = 5;
    const checkDataInterval = setInterval(async () => {
      attempts++;
      const traderDoc = await firestore
        .collection("traders")
        .doc(organizationMembership.data.public_user_data.user_id)
        .get();
      if (traderDoc.exists || attempts >= maxAttempts) {
        clearInterval(checkDataInterval);
        name = name || traderDoc.data()?.trader_name || "Unknown";
        email = email || traderDoc.data()?.trader_email || "Unknown";
        console.log("Fetched Name: ", name);
        console.log("Fetched Email: ", email);
        if (attempts >= maxAttempts) {
          console.log("Max attempts reached. Using default values.");
        }
        // Move the worker addition inside the interval to ensure it waits for the data fetch
        try {
          await workersRef.doc(organizationMembership.data.public_user_data.user_id).set({
            id: organizationMembership.data.public_user_data.user_id,
            email: email,
            name: name,
          });
          console.log("Worker added to group");
          res.status(200).send("Worker added to group");
        } catch (error) {
          console.error("Error adding worker to group", error);
          res.status(500).send("Error adding worker to group");
          return;
        }
      }
    }, 2000);
  } else {
    // If name and email are already available, add the worker immediately
    try {
      await workersRef.doc(organizationMembership.data.public_user_data.user_id).set({
        id: organizationMembership.data.public_user_data.user_id,
        email: email,
        name: name,
      });
      console.log("Worker added to group");
      res.status(200).send("Worker added to group");
    } catch (error) {
      console.error("Error adding worker to group", error);
      res.status(500).send("Error adding worker to group");
      return;
    }
  }
});

app.post("/deleteGroupWorker", async (req, res, next) => {
  console.log("deletGroupWorker endpoint hit. Processing request...");

  let payload = JSON.stringify(req.body);
  const wh = new Webhook(process.env.DELETE_ORG_WORKER_SECRET);

  const headers_svix = {
    "svix-id": String(req.get("svix-id")),
    "svix-timestamp": String(req.get("svix-timestamp")),
    "svix-signature": String(req.get("svix-signature")),
  };

  let verifiedPayload;
  try {
    verifiedPayload = wh.verify(payload, headers_svix);
  } catch (err) {
    console.log(err);
    res.status(400).json({});
    return; // Add this
  }

  // Destructuring the verified payload for cleaner and more readable code
  const { organization, public_user_data } = verifiedPayload.data;
  // Extracting organization id from the organization object and renaming it to orgId
  const { id: orgId } = organization;
  // Extracting user_id from the public_user_data object and renaming it to userId
  const { user_id: userId } = public_user_data;

  console.log(`orgId: ${orgId}, userId: ${userId}`);

  try {
    // Fetch the group document
    const groupDocRef = firestore.collection("groups").doc(orgId);
    const groupDoc = await groupDocRef.get();

    if (!groupDoc.exists) {
      console.log(`Group with id: ${orgId} not found.`);
      return res.status(404).json({ message: "Group not found" });
    }

    // Delete the worker from the group's workers collection
    await groupDocRef.collection("workers").doc(userId).delete();
    console.log(`Worker ${userId} deleted from group ${orgId}.`);

    // Fetch the plans in the group
    const plansSnapshot = await groupDocRef.collection("plans").get();
    const plans = plansSnapshot.docs.map((doc) => doc.data());

    // For each plan, delete the worker from the plan's assigned_workers collection
    for (const plan of plans) {
      const assignedWorkerDoc = await groupDocRef
        .collection("plans")
        .doc(plan.plan_id)
        .collection("assigned_workers")
        .doc(userId)
        .get();

      if (assignedWorkerDoc.exists) {
        await assignedWorkerDoc.ref.delete();
        console.log(`Worker ${userId} deleted from plan ${plan.plan_id}.`);

        // Call findAndSyncUsers function to synchronize the users
        await findAndSyncUsers(orgId, plan.plan_id, plan.internal_notes);
      }
    }

    console.log("Worker deletion completed successfully.");
    res.status(200).json({ message: "Worker deletion completed successfully" });
  } catch (error) {
    console.error("Error occurred while deleting worker: ", error);
    return next(
      new CustomError({
        message: "Failed to delete worker",
        status: 500,
        source: "handleMembershipDeleted",
      })
    );
  }
});

exports.clerkWebhook = app;
