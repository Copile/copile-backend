const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const CustomError = require("./utils/error");
const Webhook = require("svix").Webhook;
const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

const WHOP_TOKEN = process.env.whopToken;
const axios = require("axios");

/**
 * @summary Creates a new plan and assigns workers to it.
 *
 * This endpoint receives a POST request with a body containing the details of a new plan and an array of worker IDs.
 * It first checks if all the required fields for creating a new plan are present in the request body.
 * If any required fields are missing, it returns an error.
 *
 * It then creates a new plan object with the request body and some default values.
 * The group ID is temporarily removed from the plan object before it is sent to the Whop API to create the plan.
 *
 * After the plan is created, the group ID and plan ID are added back to the plan object,
 * and the plan is saved in Firestore under the corresponding group.
 *
 * If there are any worker IDs provided in the request body, the endpoint fetches each worker's document from the `workers` collection from the group in Firestore.
 * For each worker document that exists, it adds the worker's data to the `assigned_workers` sub-collection in the plan document.
 * If a worker document does not exist for a provided ID, it simply skips that ID.
 *
 * Once all existing workers have been assigned to the plan, the endpoint sends a success response.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
app.post("/createPlan", async (req, res, next) => {
  // Log the start of the plan creation process
  console.log("=====================================");
  console.log("Creating a new plan...");

  // FIXME: Doesnt seem like this is necessary, we're doing exactly this on frontend.
  // I guess just a double check?

  // Define the required fields for creating a new plan
  const requiredFields = [
    { name: "Plan Name", value: req.body.internal_notes },
    { name: "Unlimited Stock", value: req.body.unlimited_stock },
    { name: "Referral Code", value: req.body.referral_code },
    { name: "Plan Type", value: req.body.plan_type },
  ];

  if (req.body.plan_type === "renewal") {
    requiredFields.push(
      { name: "Base Currency", value: req.body.base_currency },
      { name: "Billing Period", value: req.body.billing_period },
      { name: "Initial Price", value: req.body.initial_price },
      { name: "Renewal Price", value: req.body.renewal_price },
      { name: "Trial Period Days", value: req.body.trial_period_days }
    );
  } else if (req.body.plan_type === "one_time") {
    requiredFields.push({ name: "Expiration Days", value: req.body.expiration_days });
  }

  // Check for any missing required fields in the request body
  for (const field of requiredFields) {
    if (!field.value) {
      console.log(`${field.name} is missing. Sending error response... `);
      return next(
        new CustomError({
          message: `${field.name} is missing`,
          status: 400,
          source: "createPlan",
        })
      );
    }
  }

  // Create a new plan object with the request body and some default values

  const newPlan = {
    ...req.body,
    metadata: {
      plan_name: req.body.internal_notes,
      group_id: req.body.group_id,
    },
    grace_period_days: 0,
    visibility: "hidden",
    allow_multiple_quantity: false,
    product_id: "prod_dhhu0FLQNLOKi",
    release_method: "buy_now",
  };

  console.log("New plan:", newPlan);

  // Temporarily delete group id before hitting whop. We'll add it back before saving to firestore
  delete newPlan.group_id;
  console.log("Deleted group id from new plan");

  delete newPlan.workers;
  console.log("Deleted workers from new plan");

  delete newPlan.referral_code;
  console.log("Deleted referral_code from new plan");

  try {
    console.log("New plan before hitting whop:", newPlan);

    // Send a request to the Whop API to create the plan
    const { data } = await axios.post("https://api.whop.com/api/v2/plans", newPlan, {
      headers: {
        Authorization: `Bearer ${WHOP_TOKEN}`,
      },
    });

    // Extract the group id and worker ids from the request body and reassign them to variables
    const { group_id, workers: worker_ids } = req.body;
    console.log("Group id:", group_id);
    console.log("Worker ids:", worker_ids);

    // Extract the plan id from the response data
    const plan_id = data.id;
    console.log("Plan id:", plan_id);

    // Extract the direct link from the response data
    const { direct_link } = data;
    console.log("Direct link:", direct_link);

    // Add the group id, plan id, direct link, and referral code back to the plan object
    newPlan.group_id = group_id;
    newPlan.plan_id = plan_id;
    newPlan.direct_link = direct_link;
    newPlan.referral_code = req.body.referral_code;

    // Save the new plan in Firestore under the corresponding group
    await db.collection("groups").doc(group_id).collection("plans").doc(plan_id).set(newPlan);
    console.log("Saved new plan to firestore");

    // If there are any workers specified in the request, assign them to the plan in Firestore
    if (worker_ids && worker_ids.length > 0) {
      console.log("Assigning workers to groups plan in firestore...");
      // Get the workers collection and the assigned workers collection in Firestore
      const workersCollection = db.collection("groups").doc(group_id).collection("workers");
      const assignedWorkersCollection = db
        .collection("groups")
        .doc(group_id)
        .collection("plans")
        .doc(plan_id)
        .collection("assigned_workers");

      // Fetch the worker documents from Firestore
      const workerSnapshots = await Promise.all(worker_ids.map((id) => workersCollection.doc(id).get()));

      console.log("Filtering out non-existing workers...");
      // Filter out any non-existing workers and map the snapshots to their data
      const existingWorkers = workerSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => snapshot.data());

      console.log("Existing workers:", existingWorkers);

      // Assign the workers to the plan in Firestore
      await Promise.all(
        existingWorkers.map((worker) => assignedWorkersCollection.doc(worker.id).set(worker))
      );
      console.log("Workers assigned to groups plan in firestore");

      console.log("Adding plan to workers own plans collection...");
      // Add the plan to each worker's plans collection
      const tradersCollection = db.collection("traders");
      await Promise.all(
        existingWorkers.map((worker) =>
          tradersCollection
            .doc(worker.id)
            .collection("plans")
            .doc(plan_id)
            .set({ plan_id: plan_id, plan_name: req.body.internal_notes })
        )
      );
      console.log("Plan added to workers own plans collection");
    }

    console.log("=====================================");
    // Send a success response
    res.status(200).json({ message: "Plan created successfully" });
  } catch (error) {
    console.log("Failed to create plan:", error.message);
    // If there's an error, return a custom error
    return next(
      new CustomError({
        message: "Failed to create plan",
        status: 500,
        source: "createPlan",
      })
    );
  }
});

app.post("/updatePlan", async (req, res, next) => {
  console.log("=====================================");

  console.log("updatePlan endpoint hit. Processing request...");
  const { group_id, plan_id } = req.query;
  // const {
  //   internal_notes,
  //   initial_price,
  //   trial_period_days,
  //   stock,
  //   unlimited_stock,
  //   referral_code,
  //   assigned_workers,
  // } = req.body;
  console.log(`group_id: ${group_id}, plan_id: ${plan_id}`);
  console.log(`Request body: ${JSON.stringify(req.body)}`);

  if (
    !group_id ||
    !plan_id ||
    typeof group_id !== "string" ||
    group_id.trim() === "" ||
    typeof plan_id !== "string" ||
    plan_id.trim() === ""
  ) {
    console.log("Missing or invalid required field: group_id or plan_id. Sending error response...");
    return next(
      new CustomError({
        message: "Missing or invalid required field: group_id or plan_id",
        status: 400,
        source: "updatePlan",
      })
    );
  }

  try {
    console.log(`Fetching plan with id: ${plan_id} in group: ${group_id} from Firestore...`);
    const planRef = db.collection("groups").doc(group_id).collection("plans").doc(plan_id);
    const planSnapshot = await planRef.get();

    if (!planSnapshot.exists) {
      console.log(`Plan with id: ${plan_id} in group: ${group_id} not found. Sending error response...`);
      return next(
        new CustomError({
          message: "Plan not found",
          status: 404,
          source: "updatePlan",
        })
      );
    }

    console.log("Plan found. Preparing to update...");
    // const updatedPlan = {
    //   ...planSnapshot.data(),
    //   internal_notes,
    //   metadata: {
    //     ...planSnapshot.data().metadata,
    //     plan_name: internal_notes,
    //   },
    //   initial_price,
    //   trial_period_days,
    //   stock,
    //   unlimited_stock,
    //   referral_code,
    // };

    // The updatedPlan object is created by spreading the existing plan data and the request body data.
    // This means that all properties of the existing plan and the request body will be copied into the updatedPlan object.
    // If there are any properties with the same name in both the existing plan and the request body, the value from the request body will be used.
    // This is because the properties from the request body are spread after the properties from the existing plan.
    // The metadata property of the updatedPlan object is also created by spreading.
    // It first spreads the metadata from the existing plan and then adds or overwrites the plan_name property with the internal_notes from the request body.
    // const updatedPlan = {
    //   ...planSnapshot.data(), // Spread the existing plan data
    //   ...req.body, // Spread the request body data
    //   metadata: {
    //     ...planSnapshot.data().metadata, // Spread the existing metadata
    //     plan_name: req.body.internal_notes, // Add or overwrite the plan_name property
    //   },
    // };

    console.log(`Updated plan data: ${JSON.stringify(updatedPlan)}`);

    console.log("Fetching provided groups global workers from Firestore...");
    const workersCollection = db.collection("groups").doc(group_id).collection("workers");

    const assignedWorkersCollection = planRef.collection("assigned_workers");

    console.log("Fetching the current assigned workers before updating the plan...");
    const currentAssignedWorkersSnapshot = await assignedWorkersCollection.get();
    const currentAssignedWorkers = currentAssignedWorkersSnapshot.docs.map((doc) => doc.data());
    console.log(`Current assigned workers: ${JSON.stringify(currentAssignedWorkers)}`);

    console.log("Identifying the workers that need to be added and removed...");
    // We need to identify which workers need to be added to the plan and which need to be removed.
    // To do this, we compare the list of workers currently assigned to the plan (currentAssignedWorkers) with the list of workers that should be assigned (assigned_workers).
    // Any workers that are in the assigned_workers list but not in the currentAssignedWorkers list are new and need to be added.
    // Any workers that are in the currentAssignedWorkers list but not in the assigned_workers list are no longer needed and should be removed.
    const workersToAdd = req.body.assigned_workers.filter(
      (id) => !currentAssignedWorkers.some((worker) => worker.id === id)
    );
    const workersToRemove = currentAssignedWorkers.filter(
      (worker) => !req.body.assigned_workers.includes(worker.id)
    );
    console.log(`Workers to add: ${JSON.stringify(workersToAdd)}`);
    console.log(`Workers to remove: ${JSON.stringify(workersToRemove)}`);

    console.log("Adding the new workers...");
    for (const id of workersToAdd) {
      const workerSnapshot = await workersCollection.doc(id).get();
      if (workerSnapshot.exists) {
        const worker = workerSnapshot.data();
        // Adding default stats to each worker
        worker.stats = {
          winrate: 0,
          avg_pct: 0,
          trade_count: 0,
        };
        console.log(`Adding worker: ${JSON.stringify(worker)}`);
        await assignedWorkersCollection.doc(worker.id).set(worker);
      }
    }

    console.log("Removing the workers that are no longer assigned...");
    for (const worker of workersToRemove) {
      console.log(`Removing worker: ${JSON.stringify(worker)}`);
      await assignedWorkersCollection.doc(worker.id).delete();
    }

    console.log(
      "Removing the plan from each old worker's plans collection if they are no longer assigned..."
    );
    const tradersCollection = db.collection("traders");
    await Promise.all(
      workersToRemove.map((worker) => {
        console.log(`Removing plan for worker: ${JSON.stringify(worker)}`);
        return tradersCollection.doc(worker.id).collection("plans").doc(plan_id).delete();
      })
    );

    console.log("Adding the plan to each new worker's plans collection...");
    await Promise.all(
      workersToAdd.map(async (id) => {
        const workerSnapshot = await workersCollection.doc(id).get();
        if (workerSnapshot.exists) {
          const worker = workerSnapshot.data();
          console.log(`Adding plan for worker: ${JSON.stringify(worker)}`);
          return tradersCollection
            .doc(worker.id)
            .collection("plans")
            .doc(plan_id)
            .set({ plan_id: plan_id, plan_name: updatedPlan.internal_notes });
        }
      })
    );

    console.log("Updating plan in Firestore...");
    await planRef.update(updatedPlan);
    console.log("Plan updated successfully.");

    // Sync the users
    console.log("Syncing users...");
    await findAndSyncUsers(group_id, plan_id, req.body.internal_notes);
    console.log("Users synced successfully.");

    console.log("=====================================");

    res.status(200).json({ message: "Plan updated successfully" });
  } catch (error) {
    console.log(`Failed to update plan: ${error.message}`);
    return next(
      new CustomError({
        message: "Failed to update plan",
        status: 500,
        source: "updatePlan",
      })
    );
  }
});

app.post("/deletGroupWorker", async (req, res, next) => {
  console.log("deletGroupWorker endpoint hit. Processing request...");

  let payload = JSON.stringify(req.body);
  const wh = new Webhook(process.env.CLERK_WH_SECRET);

  const headers_svix = {
    "svix-id": String(req.get("svix-id")),
    "svix-timestamp": String(req.get("svix-timestamp")),
    "svix-signature": String(req.get("svix-signature")),
  };

  let data;
  try {
    data = wh.verify(payload, headers_svix);
  } catch (err) {
    console.log(err);
    res.status(400).json({});
    return; // Add this
  }

  const { organization, public_user_data } = data;
  const { id: orgId } = organization;
  const { user_id: userId } = public_user_data;

  console.log(`orgId: ${orgId}, userId: ${userId}`);

  try {
    // Fetch the group document
    const groupDocRef = db.collection("groups").doc(orgId);
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

app.get("/getData", async (req, res, next) => {
  console.log("=====================================");

  console.log("getData endpoint hit. Processing request...");
  const { group_id } = req.query;
  console.log(`group_id: ${group_id}`);

  if (!group_id || typeof group_id !== "string" || group_id.trim() === "") {
    console.log("Missing or invalid required field: group_id. Sending error response...");
    return next(
      new CustomError({
        message: "Missing or invalid required field: group_id",
        status: 400,
        source: "getData",
      })
    );
  }

  try {
    console.log(`Fetching plans and workers for group_id: ${group_id} from Firestore...`);
    const plansSnapshot = await db.collection("groups").doc(group_id).collection("plans").get();

    const plans = [];
    for (let planDoc of plansSnapshot.docs) {
      let planData = planDoc.data();
      if (planData.plan_id && typeof planData.plan_id === "string" && planData.plan_id.trim() !== "") {
        const workersSnapshot = await db
          .collection("groups")
          .doc(group_id)
          .collection("plans")
          .doc(planData.plan_id)
          .collection("assigned_workers")
          .get();
        let workers = [];
        workersSnapshot.forEach((doc) => {
          workers.push(doc.data());
        });
        planData.assigned_workers = workers;
        plans.push(planData);
      } else {
        console.log(
          `Plan document with id: ${planDoc.id} in group: ${group_id} is missing a valid plan_id. Skipping...`
        );
      }
    }

    console.log(`Successfully fetched ${plans.length} plans. Sending response...`);
    console.log("=====================================");
    res.status(200).json(plans);
  } catch (error) {
    console.error("Error occurred while fetching plans and workers: ", error);
    return next(
      new CustomError({
        message: "Failed to get data",
        status: 500,
        source: "getData",
      })
    );
  }
});

async function findAndSyncUsers(groupId, planId, planName) {
  console.log("-------------------------------------");

  console.log(`Starting findAndSyncUsers for groupId: ${groupId} and planId: ${planId}`);
  try {
    // Fetch the plan document
    const groupDocRef = db.collection("groups").doc(groupId);
    const planDocRef = groupDocRef.collection("plans").doc(planId);
    const planDoc = await planDocRef.get();

    if (!planDoc.exists) {
      console.log(`Plan with id: ${planId} in group: ${groupId} not found.`);
      return;
    }

    // Get the workers in the plan
    const planWorkersRef = planDocRef.collection("assigned_workers");
    const planWorkersSnapshot = await planWorkersRef.get();
    const planWorkers = planWorkersSnapshot.docs.map((doc) => doc.data());
    console.log(`Fetched ${planWorkers.length} workers for planId: ${planId}`);

    // Fetch all memberships from Whop
    const response = await axios.get(
      `https://api.whop.com/v2/memberships?plan_id=${planId}&expand=[plan]&per=50`,
      {
        headers: {
          Authorization: "Bearer WRVpaQ7IWf_etpDswHmn0jPRJjuzBd2PGQEMPdUIFf4",
        },
      }
    );
    console.log(`Fetched ${response.data.data.length} memberships for planId: ${planId}`);

    // For each membership
    for (const membership of response.data.data) {
      // Construct request body for /createLicense endpoint
      const requestBody = {
        userId: membership.user,
        planId: planId,
        groupId: groupId,
        planName: planName,
      };

      const response = syncUser(requestBody, planWorkers);

      if (response.success) {
        console.log(`Successfully synced user ${membership.user}`);
      }

      // Wait 1s before doing next membership just incase it blows up
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log("-------------------------------------");
  } catch (error) {
    console.error(`Error in findAndSyncUsers for groupId: ${groupId} and planId: ${planId}`, error);
  }
}

const syncUser = async (data, planWorkers) => {
  const { userId, planId, groupId, planName } = data;
  console.log(`Starting syncUser for userId: ${userId}, planId: ${planId}, and groupId: ${groupId}`);

  try {
    // Get the user's plan document reference
    const userPlanDocRef = db.collection(`users/${userId}/plans`).doc(planId);

    // Fetch the user's plan document
    const userPlanDoc = await userPlanDocRef.get();

    if (!userPlanDoc.exists) {
      console.log(`User's plan with id: ${planId} for userId: ${userId} not found.`);
      return { success: false, error: "User's plan not found" };
    }

    // Get the workers in the user's plan
    const userPlanWorkersRef = userPlanDocRef.collection("workers");
    const userPlanWorkersSnapshot = await userPlanWorkersRef.get();
    const userPlanWorkers = userPlanWorkersSnapshot.docs.map((doc) => doc.data());
    console.log(`Fetched ${userPlanWorkers.length} workers for userId: ${userId} and planId: ${planId}`);

    // For each worker in the plan
    for (const worker of planWorkers) {
      // If the worker is not in the user's plan, add it
      if (!userPlanWorkers.some((userPlanWorker) => userPlanWorker.id === worker.id)) {
        // Initialize worker data
        worker.enabled = false; // Initialize as disabled
        worker.margin = "x"; // Initialize as "x"
        worker.percentage = "x"; // Initialize as "x"
        worker.option = "x"; // Initialize as "x"
        worker.preferred_exchange = "x"; // Initialize as "x"
        worker.plan_id = planId;
        worker.plan_name = planName;

        await userPlanWorkersRef.doc(worker.id).set(worker);
        console.log(`Added worker ${worker.id} to userId: ${userId} and planId: ${planId}`);
      }
    }

    // For each worker in the user's plan
    for (const worker of userPlanWorkers) {
      // If the worker is not in the plan, remove it
      if (!planWorkers.some((planWorker) => planWorker.id === worker.id)) {
        await userPlanWorkersRef.doc(worker.id).delete();
        console.log(`Removed worker ${worker.id} from userId: ${userId} and planId: ${planId}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error(
      `Error in syncUser for userId: ${userId}, planId: ${planId}, and groupId: ${groupId}`,
      error
    );
    return { success: false, error: error.message };
  }
};

app.post("/updateWorkerStats", async (req, res, next) => {
  console.log("=====================================");

  console.log("updateWorkerStats endpoint hit. Processing request...");
  const { group_id, plan_id, worker_id } = req.query;
  const { winrate, avg_pct, trade_count } = req.body;
  console.log(`group_id: ${group_id}, plan_id: ${plan_id}, worker_id: ${worker_id}`);
  console.log(`Request body: ${JSON.stringify(req.body)}`);

  if (
    !group_id ||
    !plan_id ||
    !worker_id ||
    typeof group_id !== "string" ||
    group_id.trim() === "" ||
    typeof plan_id !== "string" ||
    plan_id.trim() === "" ||
    typeof worker_id !== "string" ||
    worker_id.trim() === ""
  ) {
    console.log(
      "Missing or invalid required field: group_id, plan_id or worker_id. Sending error response..."
    );
    return next(
      new CustomError({
        message: "Missing or invalid required field: group_id, plan_id or worker_id",
        status: 400,
        source: "updatePlan",
      })
    );
  }

  try {
    console.log(`Fetching plan with id: ${plan_id} in group: ${group_id} from Firestore...`);
    const planRef = db.collection("groups").doc(group_id).collection("plans").doc(plan_id);
    const planSnapshot = await planRef.get();

    if (!planSnapshot.exists) {
      console.log(`Plan with id: ${plan_id} in group: ${group_id} not found. Sending error response...`);
      return next(
        new CustomError({
          message: "Plan not found",
          status: 404,
          source: "updatePlan",
        })
      );
    }

    console.log("Plan found...");

    console.log("Fetching provided plans assigned workers from Firestore...");
    const assignedWorkersCollection = planRef.collection("assigned_workers");
    console.log("Fetching the provided worker from the assigned workers collection...");
    const workerSnapshot = await assignedWorkersCollection.doc(worker_id).get();
    const worker = workerSnapshot.data();

    console.log("Updating worker stats...");
    worker.stats = {
      winrate,
      avg_pct,
      trade_count,
    };
    console.log(`Updated worker stats: ${JSON.stringify(worker)}`);

    console.log("Updating worker in Firestore...");
    await assignedWorkersCollection.doc(worker_id).update(worker);
    console.log("Worker updated successfully.");

    console.log("=====================================");

    res.status(200).json({ message: `Worker: ${worker_id} stats updated successfully` });
  } catch (error) {
    console.log(`Failed to update plan: ${error.message}`);
    return next(
      new CustomError({
        message: "Failed to update worker stats",
        status: 500,
        source: "updateWorkerStats",
      })
    );
  }
});

app.get("/", (req, res) => {
  res.send("Copile Groups API");
});

app.get("*", (req, res) => {
  return res.status(400).json("Not Authorized");
});

exports.groups = app;
