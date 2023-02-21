const Firestore = require('@google-cloud/firestore')
const db = new Firestore
const request = require("request");
const express = require("express");
const bodyParser = require('body-parser');
const datetime = require("moment");
const app = express();
app.use(express.urlencoded({ extended: true }));

async function dailyBalances(user) {
  const dates = [];
  const balances = [];
  const balancesRef = db.collection("users").doc(user).collection('balances').orderBy("date", "desc").limit(30);
  const balancesSnapshot = await balancesRef.get();

  balancesSnapshot.forEach(balance => {
    const balanceDate = datetime(balance.id * 1000).format("YYYY-DD-MM");
    if (!dates.includes(balanceDate)) {
      dates.push(balanceDate);
      balances.push(balance.get("exchanges"));
    }
  });
  
  const jsonBalances = JSON.stringify({
    user: user,
    dates: dates,
    balances: balances
  });
  console.log(jsonBalances);
  return jsonBalances;
}

app.post("/getdaily", async (req, res) => {
    const user = req.query.user;
    response = await dailyBalances(user)    
    console.log(response);


    return res.send(response);
});

app.get("/", (req, res) => {
    res.send("Hello World");
})

app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    createLicense: app
}