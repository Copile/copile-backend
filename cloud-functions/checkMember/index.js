// gcp cli command to deploy:
// gcloud functions deploy submitTrade --runtime nodejs14 --trigger-http --allow-unauthenticated --source submitTrade


const Firestore = require('@google-cloud/firestore')
const db = new Firestore
const request = require("request");
const express = require("express");
const bodyParser = require('body-parser');
const stripe = require("stripe")("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");
const WHOP_TOKEN = "wH3HEXvNgn3-mfp3M0UFpeaTCFVG8wmaF7V4rOxRoxg"
const app = express();
const cors = require('cors');

app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

const getWhopLicense = (user) => {
    return new Promise((resolve, reject) => {
      request({
        url: "https://api.whop.com/api/v2/customers/" + user,
        method: "GET",
        headers: {
          "Authorization": "Bearer " + WHOP_TOKEN
        },
        json: true
      }, (err, resp, body) => {
        if (err || resp.statusCode !== 200) {
          reject(new Error("Failed to retrieve Whop license."));
        } else {
          resolve(body);
        }
      });
    });
};
  
const getWhopPlan = (plan) => {
    return new Promise((resolve, reject) => {
      request({
        url: "https://api.whop.com/api/v2/plans/" + plan,
        method: "GET",
        headers: {
          "Authorization": "Bearer " + WHOP_TOKEN,
        },
        json: true,
      }, (err, resp, body) => {
        if (err || resp.statusCode !== 200) {
          reject(new Error("Failed to retrieve Whop plan."));
        } else {
          resolve(body);
        }
      });
    });
};
  
const getWhopProduct = (product) => {
    return new Promise((resolve, reject) => {
      request({
        url: "https://api.whop.com/api/v2/products/" + product,
        method: "GET",
        headers: {
          "Authorization": "Bearer " + WHOP_TOKEN,
        },
        json: true,
      }, (err, resp, body) => {
        if (err || resp.statusCode !== 200) {
          reject(new Error("Failed to retrieve Whop product."));
        } else {
          resolve(body);
        }
      });
    });
};
  
const getWhopself = (user) => {
    return new Promise((resolve, reject) => {
      request({
        url: `https://api.whop.com/api/v2/memberships?page=1&per=10&user_id=${user}&hide_metadata=false`,
        method: "GET",
        headers: {
          "Authorization": "Bearer " + WHOP_TOKEN
        },
        json: true
      }, (err, resp, body) => {
        if (err || resp.statusCode !== 200) {
          reject(new Error("Failed to retrieve Whop user data."));
        } else {
          resolve(body);
        }
      });
    });
};

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

const getStripeCustomer = async customer => {
    return await stripe.customers.retrieve(customer);
};

app.post("/auth", async (req, res) => {
  try {
    const user = req.query.user;
    const [licenses, userData] = await Promise.all([
      getWhopself(user),
      getWhopLicense(user),
    ]);
    const licenseObjects = await Promise.all(
      licenses.data
        .filter(({ status }) => ["active", "trialing", "past_due"].includes(status))
        .map(async ({ id, license_key, plan, product, stripe_customer_id, status, renewal_period_end, cancel_at_period_end}) => {
          const [planData, productData] = await Promise.all([
            getWhopPlan(plan),
            getWhopProduct(product),
          ]);
          const next_renewal = renewal_period_end;
          const card = planData.card_payments
            ? (
                await stripe.customers.listPaymentMethods(stripe_customer_id, { type: "card" })
              ).data[0].card.last4
            : "";
          return {
            type: planData.card_payments ? "stripe" : "crypto",
            status,
            key: license_key,
            membership: id,
            product: productData.name,
            price: planData[planData.card_payments ? "renewal_price" : "initial_price"],
            currency: planData.base_currency,
            next_renewal,
            cancel_at_period: cancel_at_period_end,
            card,
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// This endpoint creates a Stripe Billing Portal session for a given Whop membership ID
app.post('/stripe', async (req, res) => {
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