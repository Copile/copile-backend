const Firestore = require('@google-cloud/firestore')
const db = new Firestore
const datetime = require("moment");
const express = require("express");
const applyMiddleware = require('./middleware');
const app = express();
applyMiddleware(app);

async function dailyBalances(user) {
  const balanceMap = new Map();
  const balancesRef = db.collection("users").doc(user).collection('balances').orderBy("date", "desc").limit(30);
  const balancesSnapshot = await balancesRef.get();

  balancesSnapshot.forEach(balance => {
    const balanceDate = datetime(balance.id * 1000).format("YYYY-DD-MM");
    if (!balanceMap.has(balanceDate)) {
      balanceMap.set(balanceDate, balance.get("exchanges"));
    }
  });

  return {
    user: user,
    balances: [...balanceMap]
  };
}

app.get("/getDaily", async (req, res) => {
  console.log(req.headers);

    try {
      const userId = req.get('userId');
      console.log(userId);
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        return res.status(405).json({success: false, error: 'User not found for daily balances' });
      }

      balancesData  = await dailyBalances(userId);

      return res.status(200).json({success: true, message: balancesData });
    } catch(error) {
      console.log(error);
    }
});

app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    balances: app
}