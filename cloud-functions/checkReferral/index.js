const Firestore = require("@google-cloud/firestore");
const db = new Firestore();
const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));

// check referral code
app.get("/checkReferral", async (req, res, next) => {
  console.log("=====================================");

  console.log("checkReferralCode endpoint hit. Processing request...");
  const referral_code = req.query.code;
  console.log(`referral_code: ${referral_code}`);

  if (!referral_code || typeof referral_code !== "string" || referral_code.trim() === "") {
    console.log("Missing or invalid required field: referral_code. Sending error response...");
    return next(
      new CustomError({
        message: "Missing or invalid required field: referral_code",
        status: 400,
        source: "checkReferralCode",
      })
    );
  }

  try {
    const plansRef = db.collectionGroup("plans");
    const snapshot = await plansRef.where("referral_code", "==", referral_code).get();

    if (snapshot.empty) {
      console.log("No matching documents.");
      return res.send({ success: false });
    }

    const doc = snapshot.docs[0];
    console.log(doc.id, "=>", doc.data());
    const data = doc.data();
    res.send({ success: true, direct_link: data.direct_link });
  } catch (error) {
    console.error("Error occurred while fetching referral code: ", error);
    return next(
      new CustomError({
        message: "Failed to check referral code",
        status: 500,
        source: "checkReferralCode",
      })
    );
  }
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("*", (req, res) => {
  return res.status(400).send("Not Authorized");
});

exports.checkReferral = app;
