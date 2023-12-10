const Firestore = require("@google-cloud/firestore");
const db = new Firestore();

const express = require("express");
const applyMiddleware = require("./middleware");
const app = express();
applyMiddleware(app);

const WHOP_TOKEN = process.env.whopToken;

const fetchMembershipsForPage = async (planId, page, statuses = []) => {
  let url = `https://api.whop.com/api/v5/company/memberships?page=${page}&plan_id=${planId}`;
  if (statuses.length > 0) {
    url += `&statuses=${statuses.join(',')}`;
  }

  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${WHOP_TOKEN}`,
    },
  });

  return data.data;
};

const fetchAllMemberships = async (planId, totalPages, statuses) => {
  let allMemberships = [];
  for (let page = 1; page <= totalPages; page++) {
    const memberships = await fetchMembershipsForPage(planId, page, statuses);
    allMemberships = allMemberships.concat(memberships);
  }
  return allMemberships;
};

app.get("/memberships/:planId", async (req, res) => {
  const planId = req.params.planId;
  const statuses = req.query.statuses ? req.query.statuses.split(',') : [];

  try {
    const firstPageData = await fetchMembershipsForPage(planId, 1, statuses);
    const totalPages = firstPageData.pagination.total_pages;

    const allMemberships = totalPages > 1
      ? await fetchAllMemberships(planId, totalPages, statuses)
      : firstPageData.data;

    res.json(allMemberships);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});


app.post("/new_membership", async (req, res) => {
  const { data } = req.body;

  try {
    // Extract the necessary data from the request
    const planId = data.plan.id;
    const username = data.user.username;
    const renewalPrice = data.plan.renewal_price;
    const initialPrice = data.plan.initial_price;
    const createdAt = data.created_at;
    const userId = data.user.id;
    const memId = data.id;

    // Find the plan document in the Firestore database
    const plansRef = db.collectionGroup("products");
    const matchingPlans = await plansRef.where("productID", "==", planId).get();

    if (matchingPlans.empty) {
      console.log(error);
      return res
        .status(404)
        .json({ error: `Plan with id ${planId} not found.` });
    }

    const planDocSnapshot = matchingPlans.docs[0];
    const planDoc = planDocSnapshot.ref.parent.parent.id;
    // Find the trader document that owns the plan document
    const traderDocSnapshot = await planDoc;

    if (!traderDocSnapshot) {
      return res.status(404).json({ error: "Trader document not found." });
    }

    // Create a new membership document in the plan's "members" subcollection
    const membersCollection = db
      .collection("traders")
      .doc(planDoc)
      .collection("products")
      .doc(planId)
      .collection("members");
    const newMembershipDoc = membersCollection.doc(userId);
    await newMembershipDoc.set({
      username,
      created_at: createdAt,
      plan_id: planId,
      renewal_price: renewalPrice,
      initial_price: initialPrice,
      user_id: userId,
      mem_id: memId,
    });

    return res
      .status(200)
      .json({ message: "Membership created successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/delete_membership", async (req, res) => {
  const { data } = req.body;

  try {
    // Extract the necessary data from the request
    const userId = data.user.id;
    const planId = data.plan.id;

    // Find the plan document in the Firestore database
    const plansRef = db.collectionGroup("products");
    const matchingPlans = await plansRef.where("productID", "==", planId).get();

    if (matchingPlans.empty) {
      return res
        .status(404)
        .json({ error: `Plan with id ${planId} not found.` });
    }

    const planDocSnapshot = matchingPlans.docs[0];
    const planDoc = planDocSnapshot.ref.parent.parent.id;

    // Find the membership document to delete in the plan's "members" subcollection
    const membersCollection = db
      .collection("traders")
      .doc(planDoc)
      .collection("products")
      .doc(planId)
      .collection("members");
    const membershipDocSnapshot = await membersCollection.doc(userId).get();

    if (!membershipDocSnapshot.exists) {
      return res
        .status(404)
        .json({ error: `Membership document with id ${userId} not found.` });
    }

    const membershipDocRef = membershipDocSnapshot.ref;

    // Delete the membership document
    await membershipDocRef.delete();

    return res
      .status(200)
      .json({ message: "Membership deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/payment", async (req, res) => {
  const { data } = req.body;

  try {
    // Extract the necessary data from the request
    const planId = data.plan.id;
    const username = data.user.username;
    const amount = data.final_amount;
    const createdAt = data.created_at;
    const currency = data.currency;
    const userId = data.user.id;
    const paymentId = data.id;

    // Find the plan document in the Firestore database
    const plansRef = db.collectionGroup("products");
    const matchingPlans = await plansRef.where("productID", "==", planId).get();

    if (matchingPlans.empty) {
      console.log(error);
      return res
        .status(404)
        .json({ error: `Plan with id ${planId} not found.` });
    }

    const planDocSnapshot = matchingPlans.docs[0];
    const planDoc = planDocSnapshot.ref.parent.parent.id;
    // Find the trader document that owns the plan document
    const traderDocSnapshot = await planDoc;

    if (!traderDocSnapshot) {
      return res.status(404).json({ error: "Trader document not found." });
    }

    // Create a new sales document in the plan's "sales" subcollection
    const salesCollection = db
      .collection("traders")
      .doc(planDoc)
      .collection("products")
      .doc(planId)
      .collection("sales");
    const newSalesDoc = salesCollection.doc(paymentId);
    await newSalesDoc.set({
      username,
      created_at: createdAt,
      final_amount: amount,
      currency: currency,
      plan_id: planId,
      user_id: userId,
      payment_id: paymentId,
    });

    return res.status(200).json({ message: "Payment stored successfully." });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

// expose the express app as a cloud function
module.exports = {
  salestracker: app,
};
