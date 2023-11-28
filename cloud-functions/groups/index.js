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
  console.log("Creating a new plan...");

  // Define the required fields for creating a new plan
  const requiredFields = [
    "group_id",
    "base_currency",
    "billing_period",
    "initial_price",
    "internal_notes",
    "renewal_price",
    "stock",
    "trial_period_days",
    "unlimited_stock",
  ];

  // Check for any missing required fields in the request body
  const missingFields = requiredFields.filter((field) => req.body[field] === undefined);
  console.log("Missing fields:", missingFields);

  // If there are missing fields, return an error
  if (missingFields.length) {
    console.log("Error: Missing required fields");
    return next(
      new CustomError({
        message: `Missing required fields: ${missingFields.join(", ")}`,
        status: 400,
        source: "createPlan",
      })
    );
  }

  // Create a new plan object with the request body and some default values
  const newPlan = {
    ...req.body,
    grace_period_days: 0,
    visibility: "hidden",
    allow_multiple_quantity: false,
    one_per_user: true,
    plan_type: "renewal",
    product_id: "prod_dhhu0FLQNLOKi",
    release_method: "buy_now",
  };

  console.log("New plan:", newPlan);

  // Temporarily delete group id before hitting whop. We'll add it back before saving to firestore
  delete newPlan.group_id;
  console.log("Deleted group id from new plan");

  delete newPlan.workers;
  console.log("Deleted workers from new plan");

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

    // Add the group id back in and plan id to the new plan object
    newPlan.group_id = group_id;
    newPlan.plan_id = plan_id;

    // Save the new plan in Firestore under the corresponding group
    await db.collection("groups").doc(group_id).collection("plans").doc(plan_id).set(newPlan);
    console.log("Saved new plan to firestore");

    // If there are any workers specified in the request, assign them to the plan in Firestore
    if (worker_ids && worker_ids.length > 0) {
      console.log("Assigning workers to plan in firestore...");
      // Get the workers collection and the assigned workers collection in Firestore
      const workersCollection = db.collection("groups").doc(group_id).collection("workers");
      console.log("Workers collection:", workersCollection);
      const assignedWorkersCollection = db
        .collection("groups")
        .doc(group_id)
        .collection("plans")
        .doc(plan_id)
        .collection("assigned_workers");
      console.log("Assigned workers collection:", assignedWorkersCollection);

      // Fetch the worker documents from Firestore
      const workerSnapshots = await Promise.all(
        worker_ids.map((id) => workersCollection.doc(id).get())
      );

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
    }

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
  console.log("updatePlan endpoint hit. Processing request...");
  const { group_id, plan_id } = req.query;
  const {
    internal_notes,
    initial_price,
    trial_period_days,
    stock,
    unlimited_stock,
    assigned_workers,
  } = req.body;
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
    console.log(
      "Missing or invalid required field: group_id or plan_id. Sending error response..."
    );
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
      console.log(
        `Plan with id: ${plan_id} in group: ${group_id} not found. Sending error response...`
      );
      return next(
        new CustomError({
          message: "Plan not found",
          status: 404,
          source: "updatePlan",
        })
      );
    }

    console.log("Plan found. Preparing to update...");
    const updatedPlan = {
      ...planSnapshot.data(),
      internal_notes,
      initial_price,
      trial_period_days,
      stock,
      unlimited_stock,
    };
    console.log(`Updated plan data: ${JSON.stringify(updatedPlan)}`);

    console.log("Fetching workers from Firestore...");
    const workersCollection = db.collection("groups").doc(group_id).collection("workers");
    const assignedWorkersCollection = planRef.collection("assigned_workers");

    console.log("Deleting old assigned workers...");
    await assignedWorkersCollection.get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        doc.ref.delete();
      });
    });
    console.log("Old assigned workers deleted.");

    if (assigned_workers && assigned_workers.length > 0) {
      console.log("Assigning new workers to the plan...");
      const workerSnapshots = await Promise.all(
        assigned_workers.map((id) => workersCollection.doc(id).get())
      );

      console.log("Filtering out non-existing workers...");
      const existingWorkers = workerSnapshots
        .filter((snapshot) => snapshot.exists)
        .map((snapshot) => snapshot.data());

      console.log(`Existing workers: ${JSON.stringify(existingWorkers)}`);

      await Promise.all(
        existingWorkers.map((worker) => {
          console.log(`Assigning worker: ${JSON.stringify(worker)}`);
          return assignedWorkersCollection.doc(worker.id).set(worker);
        })
      );
      console.log("New workers assigned.");
    }

    console.log("Updating plan in Firestore...");
    await planRef.update(updatedPlan);
    console.log("Plan updated successfully.");

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
      if (
        planData.plan_id &&
        typeof planData.plan_id === "string" &&
        planData.plan_id.trim() !== ""
      ) {
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

// Add worker to plan endpoint, and resynchronize with users

// Remove worker from plan endpoint, and resynchronize with users. Do we also need to remove the worker from the group?

app.get("/", (req, res) => {
  res.send("Copile Groups API");
});

app.get("*", (req, res) => {
  return res.status(400).json("Not Authorized");
});

exports.groups = app;
