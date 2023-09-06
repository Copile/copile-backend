const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();
const applyMiddleware = require('./middleware');
const app = express();
const axios = require('axios');

applyMiddleware(app);

const DISCORD_CLIENT_ID = '1092448427360653312';
const DISCORD_CLIENT_SECRET = 'FoVz5mC7igCsnDPcjXhfrtmD1248camG';
// const REDIRECT_URI = 'https://us-central1-copile.cloudfunctions.net/storeOAuthId/OAuthCallback/discord';
const REDIRECT_URI = "http://localhost:3000/api/functions/discordCallback"

app.get('/discord/connect', (req, res) => {
  const queryParams = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${queryParams.toString()}`;
  
  // Redirect the user to the Discord authorization URL
  res.redirect(authUrl);
});


app.get('/OAuthCallback/discord', async (req, res) => {
  try {
    // const { code } = req.query;
    const code = req.get('code')
    const user = req.get('userId');

    if (!code) {
      return res.status(400).send('Code parameter missing.');
    }

    if (!user) {
      return res.status(400).send('User id missing.');
    }

    const tokenData = await exchangeCodeForToken(code);

    if (!tokenData) {
      return res.status(500).send('Error exchanging code for token.');
    }

    const discordUserId = await getDiscordUserId(tokenData.access_token);

    if (!discordUserId) {
      return res.status(500).send('Error retrieving Discord user ID.');
    }

    await saveDiscordUserIdToFirestore(user, discordUserId);

    return res.send('Discord ID saved successfully.');
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Error saving Discord ID.');
  }
});

async function exchangeCodeForToken(code) {
  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return tokenResponse.data;
  } catch (error) {
    throw new Error('Token exchange failed.', error);
  }
}

async function getDiscordUserId(accessToken) {
  try {
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return userResponse.data.id;
  } catch (error) {
    throw new Error('Error retrieving Discord user data.', error);
  }
}

async function saveDiscordUserIdToFirestore(user, discordUserId) {
  const usersRef = db.collection('users');
  try {

    await usersRef.doc(user).update({
      discord: discordUserId
    })
  } catch (error) {
    console.error('Error:', error);
  }
}

exports.OAuthCallback = app;
