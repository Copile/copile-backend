const express = require("express");
const router = express.Router();
const { fetchItemsForPage, fetchAllItems } = require("./utils");

// Function to create a filter for planId and statuses
const createMembershipFilter = (planId, statuses) => {
  return (item) =>
    item.plan_id === planId &&
    (statuses.length === 0 || statuses.includes(item.status));
};

// Route for fetching memberships
router.get("/memberships/:planId", async (req, res) => {
  const planId = req.params.planId;
  const statuses = req.query.statuses ? req.query.statuses.split(",") : [];
  const filterFunction = createMembershipFilter(planId, statuses);

  try {
    const firstPageData = await fetchItemsForPage(
      `https://api.whop.com/api/v5/company/memberships?page=1`
    );
    const totalPages = firstPageData.pagination.total_pages;

    const allMemberships = await fetchAllItems(
      "company/memberships",
      filterFunction,
      totalPages
    );
    res.json(allMemberships);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Route for fetching payments
router.get("/payments/:planId", async (req, res) => {
  const planId = req.params.planId;
  const filterByPlanId = (item) => item.plan_id === planId;

  try {
    const firstPageData = await fetchItemsForPage(
      `https://api.whop.com/api/v5/company/payments?page=1`
    );
    const totalPages = firstPageData.pagination.total_pages;

    const allPayments = await fetchAllItems(
      "company/payments",
      filterByPlanId,
      totalPages
    );
    res.json(allPayments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/new_membership", async (req, res) => {
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

router.post("/delete_membership", async (req, res) => {
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

router.post("/payment", async (req, res) => {
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

module.exports = router;
