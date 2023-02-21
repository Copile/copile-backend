const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const app = express();

app.use(express.json());

const firestore = new Firestore();

async function createSecret(secretName, payload) {
  // Imports the Secret Manager library
  const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

  // Instantiates a client
  const client = new SecretManagerServiceClient();

  // Create the secret
  const [secret] = await client.createSecret({
    parent: `projects/copile`,
    secretId: secretName,
    secret: {
      replication: {
        automatic: {},
      },
    },
  });

  // Add a version to the secret
  const [version] = await client.addSecretVersion({
    parent: secret.name,
    payload: {
      data: Buffer.from(payload, 'utf8'),
    },
  });

  // Return the secret name
  return secret.name;
}

app.post('/api/update_exchange', async (req, res) => {
    const userId = req.body.userId;
    const exchange = req.body.exchange;
    const api_key = req.body.api_key;
    const api_secret = req.body.api_secret;
    const api_passphrase = req.body.api_passphrase;
    const userRef = firestore.collection('users').doc(userId);
  
    // check if api_passphrase is required
    if (exchange === 'kucoin' && !api_passphrase) {
        res.status(400).json({ success: false, error: `api_passphrase is required for ${exchange} exchange` });
    } else {
        const updateFields = {
            [`exchanges.${exchange}.api_key`]: api_key,
            [`exchanges.${exchange}.api_secret`]: api_secret
        };
        
        if (exchange === 'kucoin') {
            updateFields[`exchanges.${exchange}.api_passphrase`] = api_passphrase;
        }
        
        userRef.update(updateFields)
        .then(() => {
            console.log(`Exchange information updated successfully - ${userId}!`);
            res.status(200).json({ success: true, message: `Exchange information updated successfully - ${userId}!` });
        })
        .catch((error) => {
            console.error(`Error updating document: ${error}`);
            res.status(500).json({ success: false, error: `Error updating document: ${userId}` });
        });
    }
});

app.get("/", (req, res) => {
    res.send("Hello World");
})

app.get("*", (req, res) => {
    return res.status(400).send("Not Authorized");
});


// expose the express app as a cloud function
module.exports = {
    member: app
}