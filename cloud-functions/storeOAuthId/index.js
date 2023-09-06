const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();
const applyMiddleware = require('./middleware');
const app = express();
const axios = require('axios');

applyMiddleware(app);

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET =  process.env.DISCORD_CLIENT_SECRET;
// const REDIRECT_URI = 'https://us-central1-copile.cloudfunctions.net/storeOAuthId/OAuthCallback/discord';
const REDIRECT_URI = process.env.REDIRECT_URI;

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

    const discordUserData = await getDiscordUserData(tokenData.access_token);

    if (!discordUserData) {
      return res.status(500).send('Error retrieving Discord user ID.');
    }

    await saveDiscordUserIdToFirestore(user, discordUserData);

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

async function getDiscordUserData(accessToken) {
  try {
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    return {
      id: userResponse.data.id,
      username: userResponse.data.username,
      avatar: `https://cdn.discordapp.com/avatars/${userResponse.data.id}/${userResponse.data.avatar}.png`
    };
  } catch (error) {
    throw new Error('Error retrieving Discord user data.', error);
  }
}

async function saveDiscordUserIdToFirestore(user, discordUserData) {
  const usersRef = db.collection('users');
  try {
    await usersRef.doc(user).update({
      discord: discordUserData
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

exports.OAuthCallback = app;
