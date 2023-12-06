const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();
const express = require("express");
// const CustomError = require("./utils/error");
const app = express();
app.use(express.urlencoded({ extended: true }));

// check referral code
app.get("/checkReferral", async (req, res, next) => {
  console.log("=====================================");

  console.log("checkReferralCode endpoint hit. Processing request...");
  const referral_code = req.query.code;
  console.log(`referral_code: ${referral_code}`);

  if (!referral_code) {
    console.log("Missing required field: referral_code. Sending error response...");
    return res
      .status(400)
      .send({ success: false, message: "Missing or invalid required field: referral_code" });
    // return next(
    //   new CustomError({
    //     message: "Missing or invalid required field: referral_code",
    //     status: 400,
    //     source: "checkReferralCode",
    //   })
    // );
  }

  try {
    console.log("Attempting to fetch referral code from database...");
    const plansRef = db.collectionGroup("plans");
    console.log("plansRef: ", plansRef);
    const snapshot = await plansRef.where("referral_code", "==", referral_code).get();
    console.log("Snapshot: ", snapshot);

    if (snapshot.empty) {
      console.log("No matching documents. Sending error response...");
      return res.send({ success: false, message: "No matching referral." });
    }

    const doc = snapshot.docs[0];
    console.log(`Found matching document: ${doc.id} => ${JSON.stringify(doc.data())}`);
    const data = doc.data();
    console.log("Sending success response with direct link...");
    return res.send({ success: true, direct_link: data.direct_link });
  } catch (error) {
    console.error("Error occurred while fetching referral code: ", error);
    return res.status(500).send({ success: false, message: "Failed to check referral code" });
    // return next(
    //   new CustomError({
    //     message: "Failed to check referral code",
    //     status: 500,
    //     source: "checkReferralCode",
    //   })
    // );
  }
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

exports.checkReferral = app;
