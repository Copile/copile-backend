const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const CustomError = require("./utils/error");
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
  console.log("====== STARTING PLAN CREATION ======");
  console.log("Creating a new plan...");

  // Define the required fields for creating a new plan
  const requiredFields = [
    { name: "Plan Name", value: req.body.internal_notes },
    { name: "Referral Code", value: req.body.referral_code },
    { name: "Plan Type", value: req.body.plan_type },
  ];

  if (req.body.plan_type === "renewal") {
    requiredFields.push(
      { name: "Base Currency", value: req.body.base_currency },
      { name: "Billing Period", value: req.body.billing_period },
      // { name: "Initial Price", value: req.body.initial_price },
      { name: "Renewal Price", value: req.body.renewal_price }
      // { name: "Trial Period Days", value: req.body.trial_period_days }
    );
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

  // Check for Unlimited Stock field separately as it is a boolean
  if (req.body.unlimited_stock === undefined || req.body.unlimited_stock === null) {
    console.log("Unlimited Stock is missing. Sending error response...");
    return next(
      new CustomError({
        message: "Unlimited Stock is missing",
        status: 400,
        source: "createPlan",
      })
    );
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
      await Promise.all(existingWorkers.map((worker) => assignedWorkersCollection.doc(worker.id).set(worker)));
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

    console.log("====== FINISHED CREATING PLAN ======");
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
  console.log("======= STARTING PLAN UPDATE =======");
  console.log("updatePlan endpoint hit. Processing request...");
  const { group_id, plan_id } = req.query;
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

    /**
     * @description The updatedPlan object is created by spreading the existing plan data and the request body data.
     * This means that all properties of the existing plan and the request body will be copied into the updatedPlan object.
     * If there are any properties with the same name in both the existing plan and the request body, the value from the request body will be used.
     * This is because the properties from the request body are spread after the properties from the existing plan.
     * The metadata property of the updatedPlan object is also created by spreading.
     * It first spreads the metadata from the existing plan and then adds or overwrites the plan_name property with the internal_notes from the request body.
     */
    const updatedPlan = {
      ...planSnapshot.data(), // Spread the existing plan data
      ...req.body, // Spread the request body data. This will overwrite any existing properties from planSnapshot with the same name
      metadata: {
        ...planSnapshot.data().metadata, // Spread the existing metadata
        plan_name: req.body.internal_notes, // Add or overwrite the plan_name property
      },
    };
    console.log(`Updated plan data: ${JSON.stringify(updatedPlan)}`);

    // =========== FETCHING DATA ===========
    console.log("Fetching provided groups global workers from Firestore...");
    const workersCollection = db.collection("groups").doc(group_id).collection("workers");
    const assignedWorkersCollection = planRef.collection("assigned_workers");

    console.log("Fetching the current assigned workers before updating the plan...");
    const currentAssignedWorkersSnapshot = await assignedWorkersCollection.get();
    const currentAssignedWorkers = currentAssignedWorkersSnapshot.docs.map((doc) => doc.data());
    console.log(`Current assigned workers: ${JSON.stringify(currentAssignedWorkers)}`);

    // =========== IDENTIFYING WORKERS ===========
    /**
     * @description Identifies which workers need to be added to the plan and which need to be removed.
     * Compares the list of workers currently assigned to the plan (currentAssignedWorkers) with the list of workers that should be assigned (assigned_workers).
     * Any workers that are in the assigned_workers list but not in the currentAssignedWorkers list are new and need to be added.
     * Any workers that are in the currentAssignedWorkers list but not in the assigned_workers list are no longer needed and should be removed.
     */
    console.log("Identifying the workers that need to be added and removed...");
    const workersToAdd = req.body.assigned_workers.filter(
      (id) => !currentAssignedWorkers.some((worker) => worker.id === id)
    );
    console.log(`Workers to add: ${JSON.stringify(workersToAdd)}`);

    const workersToRemove = currentAssignedWorkers.filter(
      (worker) => !req.body.assigned_workers.includes(worker.id)
    );
    console.log(`Workers to remove: ${JSON.stringify(workersToRemove)}`);

    const tradersCollection = db.collection("traders");
    /*
     * =====================================================================
     * ========================= ACTION SEPERATION =========================
     * =====================================================================
     */

    // =========== UPDATING PLAN IN WHOP ===========
    /**
     * @description Once we've fetched all the data we need, we will first update the plan in Whop.
     * This is because if we update the plan in Firestore first, and then the plan update fails in Whop,
     * we will have to revert the plan update in Firestore as well.
     * If we first fetch the data and then update the whop plan, it reduces the chances of having to revert the plan update in Firestore, in case
     * the fetch failed.
     */
    console.log("Updating plan in Whop...");
    const whopUpdateData = {
      internal_notes: req.body.internal_notes,
      trial_period_days: req.body.trial_period_days,
      unlimited_stock: req.body.unlimited_stock,
      stock: req.body.stock,
      metadata: {
        group_id: req.body.group_id,
        plan_name: req.body.internal_notes,
      },
    };
    const whopResponse = await axios.post(`https://api.whop.com/api/v2/plans/${plan_id}`, whopUpdateData, {
      headers: {
        Authorization: `Bearer ${WHOP_TOKEN}`,
      },
    });

    console.log("Whop plan updated successfully:", whopResponse.data);

    // =========== DELETING WORKERSTOREMOVE ===========
    if (workersToRemove.length > 0) {
      console.log("Deleting the workers to remove...");
      for (const worker of workersToRemove) {
        console.log(`Removing worker: ${JSON.stringify(worker)}`);
        await assignedWorkersCollection.doc(worker.id).delete();
      }

      // =========== REMOVING PLAN FROM EACH WORKERSTOREMOVE PLANS COLLECTION ===========
      console.log("Removing the plan from each workers to remove plans collection...");
      await Promise.all(
        workersToRemove.map((worker) => {
          console.log(`Removing plan for worker: ${JSON.stringify(worker)}`);
          return tradersCollection.doc(worker.id).collection("plans").doc(plan_id).delete();
        })
      );
    } else {
      console.log(
        "No workers to remove, skipping deleting workers from the groups > plans > assigned_workers collection and removing the plan from each workers plans collection"
      );
    }

    // =========== UPDATING PLAN NAME FOR WORKERS THAT ARE STILL ASSIGNED ===========
    /**
     * @description Once we've removed the workers that are no longer assigned, we can first remove
     * the plan name for the workers that are still assigned
     */
    const currentPlanData = planSnapshot.data();
    if (req.body.internal_notes && currentPlanData.internal_notes !== req.body.internal_notes) {
      console.log("Plan name changed, updating the plan name for each worker that is still assigned...");

      // Update the plan name in each worker's plan document
      await Promise.all(
        currentAssignedWorkers.map((worker) => {
          const workerPlanRef = tradersCollection.doc(worker.id).collection("plans").doc(plan_id);

          console.log(`Updating plan name for worker: ${worker.id}`);
          return workerPlanRef.update({ plan_name: req.body.internal_notes });
        })
      );

      console.log("Plan name updated for each worker that is still assigned.");
    }

    if (workersToAdd.length > 0) {
      // =========== ADDING WORKERSTOADD ===========
      console.log("Adding the new workers...");
      await Promise.all(
        workersToAdd.map(async (id) => {
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
            return assignedWorkersCollection.doc(worker.id).set(worker);
          }
        })
      );

      // =========== ADDING PLAN TO EACH WORKERSTOADD PLANS COLLECTION ===========
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
    } else {
      console.log(
        "No new workers to add, skipping adding workers to the groups > plans > assigned_workers collection and adding the plan to each workers plans collection"
      );
    }

    // =========== UPDATING PLAN IN FIRESTORE ===========
    console.log("Updating plan in Firestore...");
    await planRef.update(updatedPlan);
    console.log("Plan updated successfully.");

    // =========== SYNCING USERS ===========
    console.log("Syncing users...");
    await findAndSyncUsers(group_id, plan_id, req.body.internal_notes);
    console.log("Users synced successfully.");

    console.log("======= FINISHED UPDATING PLAN =======");
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

app.get("/getData", async (req, res, next) => {
  console.log("====== STARTING GET DATA ======");

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
    const whopRequests = []; // Array to hold promises for Whop API requests

    for (let planDoc of plansSnapshot.docs) {
      let planData = planDoc.data();

      if (planData.plan_id && typeof planData.plan_id === "string" && planData.plan_id.trim() !== "") {
        // Add a promise to fetch data from the Whop API to the array
        whopRequests.push(
          axios.get(`https://api.whop.com/v2/plans/${planData.plan_id}`, {
            headers: {
              Authorization: `Bearer ${WHOP_TOKEN}`,
            },
          })
        );

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

    /**
     * @description This operation is necessary because when we fetch the data, we're getting a majority of it from Firestore.
     * We need to do this because we need the assigned workers data. However, for attributes like stock, which are updated by
     * external forces such as users purchasing the plan, and not from the main source updating it themselves, we have to fetch
     * the plan data from Whop and replace the stock. We could indeed just pass the entire plan data that we get from Whop
     * instead of using what's in Firestore, but we'd still need to do the Firestore operations anyway because we need that
     * assigned trader data. This operation can be refactored in the future for optimization such as storing the
     * assigned_workers data in the plans metadata.
     */
    const whopResponses = await Promise.all(whopRequests);
    whopResponses.forEach((response, index) => {
      // Replace the stock info in the plan with the data from the Whop API

      /**
       * @description Updates the stock info in the plan with the data from the Whop API.
       * If the 'unlimited_stock' property is false, then the stock can be updated.
       * This check is necessary because the Whop API responds with stock as "0" if 'unlimited_stock' is true,
       * which would interfere with the frontend. The frontend assumes that when stock is null, it is unlimited,
       * and when stock is a number, it is limited.
       */
      if (!response.data.unlimited_stock) {
        plans[index].stock = response.data.stock;
      }
    });

    console.log(`Successfully fetched ${plans.length} plans. Sending response...`);
    console.log("====== FINISHED GET DATA ======");
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

// app.get("/getData", async (req, res, next) => {
//   console.log("====== STARTING GET DATA ======");

//   console.log("getData endpoint hit. Processing request...");
//   const { group_id } = req.query;
//   console.log(`group_id: ${group_id}`);

//   if (!group_id || typeof group_id !== "string" || group_id.trim() === "") {
//     console.log("Missing or invalid required field: group_id. Sending error response...");
//     return next(
//       new CustomError({
//         message: "Missing or invalid required field: group_id",
//         status: 400,
//         source: "getData",
//       })
//     );
//   }

//   try {
//     console.log(`Fetching plans and workers for group_id: ${group_id} from Firestore...`);
//     const plansSnapshot = await db.collection("groups").doc(group_id).collection("plans").get();

//     const plans = [];
//     for (let planDoc of plansSnapshot.docs) {
//       let planData = planDoc.data();

//       if (planData.plan_id && typeof planData.plan_id === "string" && planData.plan_id.trim() !== "") {
//         const workersSnapshot = await db
//           .collection("groups")
//           .doc(group_id)
//           .collection("plans")
//           .doc(planData.plan_id)
//           .collection("assigned_workers")
//           .get();
//         let workers = [];
//         workersSnapshot.forEach((doc) => {
//           workers.push(doc.data());
//         });
//         planData.assigned_workers = workers;
//         plans.push(planData);
//       } else {
//         console.log(
//           `Plan document with id: ${planDoc.id} in group: ${group_id} is missing a valid plan_id. Skipping...`
//         );
//       }
//     }

//     console.log(`Successfully fetched ${plans.length} plans. Sending response...`);
//     console.log("====== FINISHED GET DATA ======");
//     res.status(200).json(plans);
//   } catch (error) {
//     console.error("Error occurred while fetching plans and workers: ", error);
//     return next(
//       new CustomError({
//         message: "Failed to get data",
//         status: 500,
//         source: "getData",
//       })
//     );
//   }
// });

async function findAndSyncUsers(groupId, planId, planName) {
  console.log("--- STARTING FIND AND SYNC USERS ---");

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

    console.log("--- FINISHED FIND AND SYNC USERS ---");
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

    // Update the plan name in the user's plan
    await userPlanDocRef.update({ plan_name: planName });
    console.log(`Updated plan name to ${planName} in user's plan with id: ${planId} for userId: ${userId}`);

    // Get the workers in the user's plan
    const userPlanWorkersRef = userPlanDocRef.collection("workers");
    const userPlanWorkersSnapshot = await userPlanWorkersRef.get();
    const userPlanWorkers = userPlanWorkersSnapshot.docs.map((doc) => doc.data());
    console.log(`Fetched ${userPlanWorkers.length} workers for userId: ${userId} and planId: ${planId}`);

    // For each worker in the plan
    for (const worker of planWorkers) {
      // If the worker is not in the user's plan, add it
      if (!userPlanWorkers.some((userPlanWorker) => userPlanWorker.id === worker.id)) {
        const workerDataForUserPlan = {
          id: worker.id,
          name: worker.name,
          enabled: false,
          margin: "x",
          percentage: "x",
          option: "x",
          preferred_exchange: "x",
          plan_id: planId,
          plan_name: planName,
        };
        await userPlanWorkersRef.doc(worker.id).set(workerDataForUserPlan);
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
    console.error(`Error in syncUser for userId: ${userId}, planId: ${planId}, and groupId: ${groupId}`, error);
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
    console.log("Missing or invalid required field: group_id, plan_id or worker_id. Sending error response...");
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
