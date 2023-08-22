const request = require("request");
const express = require("express");
const stripe = require("stripe")(process.env.stripeToken);
const jwt = require('jsonwebtoken');
// const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const WHOP_TOKEN = process.env.whopToken
const Firestore = require('@google-cloud/firestore')
const db = new Firestore

// // New secret manager client for future transfer from env
// const secretManagerClient = new SecretManagerServiceClient();

// Connect Middleware
const applyMiddleware = require('./middleware');
const app = express();
applyMiddleware(app);

const getWhopMem = (mem_id) => {
    return new Promise((resolve, reject) => {
      request({
        url: `https://api.whop.com/api/v2/memberships/${mem_id}`,
        method: "GET",
        headers: {
          "Authorization": "Bearer " + WHOP_TOKEN
        },
        json: true
      }, (err, resp, body) => {
        if (err || resp.statusCode !== 200) {
          reject(new Error("Failed to retrieve Whop membership data."));
        } else {
          resolve(body);
        }
      });
    });
};

const requestAsync = async (options) => {
  return new Promise((resolve, reject) => {
    request(options, (err, resp, body) => {
      if (err || resp.statusCode !== 200) {
        reject(new Error("Failed to retrieve data."));
      } else {
        resolve(body);
      }
    });
  });
};

const getWhopData = async (path, id) => {
  return await requestAsync({
    url: `https://api.whop.com/api/v2/${path}${id}`,
    method: "GET",
    headers: {
      "Authorization": "Bearer " + WHOP_TOKEN
    },
    json: true
  });
};

app.post("/auth", async (req, res) => {
  try {
    const userId = req.get("x-forwarded-authorization").split(" ")[1]

    console.log("userId in /auth", userId)
   
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "UserId is missing"
      });
    }
    
    const [licenses, userData] = await Promise.all([
      getWhopData("memberships?page=1&per=10&user_id=", userId + "&hide_metadata=false"),
      getWhopData("customers/", userId)
    ]);
    
    // Check if the userId is present in the userData
    if (!userData || userData.id !== userId) {
      return res.status(404).json({
        success: false,
        error: "UserId doesn't exist"
      });
    }
    const licenseObjects = await Promise.all(
      licenses.data
        .filter(({ status }) => ["active", "trialing", "past_due", "completed"].includes(status))
        .map(async (license) => {
          const [planData, productData] = await Promise.all([
            getWhopData("plans/", license.plan),
            getWhopData("products/", license.product)
          ]);
          const next_renewal = license.renewal_period_end;

          return {
            type: planData.card_payments ? "stripe" : "crypto",
            status: license.status,
            planID: planData.id,
            key: license.license_key,
            membership: license.id,
            product: productData.name,
            price: planData[planData.card_payments ? "renewal_price" : "initial_price"],
            currency: planData.base_currency,
            next_renewal,
            expires_at: license.expires_at,
            cancel_at_period: license.cancel_at_period_end,
          };
        })
    );

    const userobj = {
      success: true,
      user: userData,
      licenses: licenseObjects,
    };
    
    res.status(200).json(userobj);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Contact support.",
    });
  }
});

app.get("/verify", async (req, res) => {
  try {

    const token = req.get("x-forwarded-authorization").split(" ")[1]


    // // Access the JWT secret from Google Cloud Secrets
    // const [secret] = await secretManagerClient.accessSecretVersion({
    //   name: 'projects/[PROJECT_ID]/secrets/[SECRET_NAME]/versions/latest'
    // });
    // const jwtSecret = secret.payload.data.toString('utf8');

    const jwtSecret = process.env.JWT_SECRET

    // Decode and verify the JWT token
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.user;


    // Check if the user exists in Firestore
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log("No userId exists")
      return res.status(404).json({
        success: false,
        error: "UserId doesn't exist"
      });
    }

    res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Failed to verify user.",
    });
  }
});

// This endpoint creates a Stripe Billing Portal session for a given Whop membership ID
app.post('/stripe', async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1]

  console.log("userId in /auth", userId)

  if (!userId) {
    return res.status(400).json({ success: false, error: 'User name is missing' });
  }

  const userDoc = await db.collection('users').doc(userId);

  if (!userDoc.exists) {
    return res.status(404).json({success: false, error: 'User not found for stripe' });
  }

  const { mem_id, return_url } = req.body;

  // Check if the required mem_id parameter is present in the request body
  if (!mem_id) {
    return res.status(400).json({ success: false, error: 'Missing mem_id parameter' });
  }

  // Check if the required return_url parameter is present in the request body
  if (!return_url) {
    return res.status(400).json({ success: false, error: 'Missing return_url parameter' });
  }

  try {
    // Retrieve Whop membership data for the given mem_id
    const whopData = await getWhopMem(mem_id);

    // Check if the Whop membership data includes a Stripe customer ID
    if (!whopData.stripe_customer_id) {
      return res.status(400).json({ success: false, error: 'Whop membership data does not include stripe_customer_id' });
    }

    // Create a Stripe Billing Portal session for the given Stripe customer ID and return URL
    const session = await stripe.billingPortal.sessions.create({
      customer: whopData.stripe_customer_id,
      return_url: return_url,
    });

    // Return the URL of the created Stripe Billing Portal session
    return res.json({ success: true, url: session.url });
  } catch (err) {
    console.error(err);

    // If an error occurs during the process, return an error message
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/cancel', async (req, res) => {
  const userId = req.get("x-forwarded-authorization").split(" ")[1]

  console.log("userId in /auth", userId)

  if (!userId) {
    return res.status(400).json({ success: false, error: 'User name is missing' });
  }

  const userDoc = await db.collection('users').doc(userId);

  if (!userDoc.exists) {
    return res.status(404).json({success: false, error: 'User not found for cancel' });
  }

  const { mem_id } = req.body;

  try {
    const response = await new Promise((resolve, reject) => {
      request({
        url: `https://api.whop.com/api/v2/memberships/${mem_id}/cancel`,
        method: "POST",
        headers: {
          "Authorization": "Bearer " + WHOP_TOKEN
        },
        json: true
      }, (err, resp, body) => {
        if (err || resp.statusCode !== 201) {
          reject(new Error("Failed to cancel Whop membership."));
        } else {
          resolve(body);
        }
      });
    });

    res.status(200).json({ success: true, message: "Whop membership cancelled successfully", response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to cancel Whop membership." });
  }
});

app.get("/", (req, res) => {
    res.send("Copile API");
})

app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    checkMember: app
}