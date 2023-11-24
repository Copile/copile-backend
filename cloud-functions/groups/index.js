const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const CustomError = require("./utils/error");

const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

const WHOP_TOKEN = process.env.whopToken;
const axios = require("axios");

app.post("/createPlan", async (req, res, next) => {
  console.log("Creating a new plan...");
  const requiredFields = [
    "group_id",
    "base_currency",
    "billing_period",
    "intial_price",
    "internal_notes",
    "renewal_price",
    "stock",
    "trial_period_days",
    "unlimited_stock",
  ];
  console.log("Required fields: ", requiredFields);

  const missingFields = requiredFields.filter((field) => !req.body[field]);
  console.log("Missing fields: ", missingFields);

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

  const newPlan = {
    ...req.body,
    grace_period_days: 0,
    visibility: "hidden",
    allow_multiple_quantitiy: true,
    one_per_user: true,
    plan_type: "renewal",
    product_id: "prod_dhhu0FLQNLOKi",
    release_method: "buy_now",
  };
  console.log("New plan: ", newPlan);

  try {
    console.log("Sending request to create plan...");
    await axios.post("https://api.whop.com/api/v2/plans", newPlan, {
      headers: {
        Authorization: `Bearer ${WHOP_TOKEN}`,
      },
    });
    console.log("Request sent successfully");

    newPlan.workers = [];
    console.log("Adding workers to the new plan...");
    await db
      .collection("groups")
      .doc(req.body.group_id)
      .collection("plans")
      .doc(plan_id)
      .set(newPlan);
    console.log("Workers added successfully");
    res.status(200).json({ message: "Plan created successfully" });
  } catch (error) {
    console.log("Error: Failed to create plan");
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
  const requiredFields = [
    "plan_id",
    "group_id",
    "intial_price",
    "internal_notes",
    "stock",
    "trial_period_days",
    "unlimited_stock",
  ];

  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length) {
    return next(
      new CustomError({
        message: `Missing required fields: ${missingFields.join(", ")}`,
        status: 400,
        source: "updatePlan",
      })
    );
  }

  try {
    // Update the plan in Whop
    await axios.post(`https://api.whop.com/api/v2/plans/${req.body.plan_id}`, updatedPlan, {
      headers: {
        Authorization: `Bearer ${WHOP_TOKEN}`,
      },
    });

    // Update the plan in Firestore
    await db
      .collection("groups")
      .doc(req.body.group_id)
      .collection("plans")
      .doc(req.body.plan_id)
      .update(updatedPlan);

    res.status(200).json({ message: "Plan updated successfully" });
  } catch (error) {
    return next(
      new CustomError({
        message: "Failed to update plan",
        status: 500,
        source: "updatePlan",
      })
    );
  }
});

app.get("/getPlans", async (req, res, next) => {
  const { group_id } = req.query;

  if (!group_id) {
    return next(
      new CustomError({
        message: "Missing required field: group_id",
        status: 400,
        source: "getPlans",
      })
    );
  }

  try {
    const plansSnapshot = await db.collection("groups").doc(group_id).collection("plans").get();

    const plans = [];
    plansSnapshot.forEach((doc) => {
      plans.push(doc.data());
    });

    res.status(200).json(plans);
  } catch (error) {
    return next(
      new CustomError({
        message: "Failed to get plans",
        status: 500,
        source: "getPlans",
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
