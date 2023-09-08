const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();
const applyMiddleware = require("./middleware");
const app = express();
const axios = require("axios");

applyMiddleware(app);

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const TELEGRAM_BOT_KEY = process.env.KEY_TELEGRAM_BOT_KEY;

app.get("/callback/discord", async (req, res) => {
  try {
    const user = req.get("userId");
    const code = req.query.code;

    if (!code) {
      return res.status(400).send("Code parameter missing.");
    }

    if (!user) {
      return res.status(400).send("User id missing.");
    }

    const tokenData = await exchangeCodeForToken(code);

    if (!tokenData) {
      return res.status(500).send("Error exchanging code for token.");
    }

    const discordUserData = await getDiscordUserData(tokenData.access_token);

    if (!discordUserData) {
      return res.status(500).send("Error retrieving Discord user data.");
    }

    await saveUserDataToFirestore(user, discordUserData, "discord");

    return res.send("Discord User data saved successfully.");
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error saving Discord User data.");
  }
});

app.post("/callback/telegram", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(200).send("No message received.");
    }
    token = message.text.split(" ")[1];

    if (!token) {
      return res.status(200).send("No token received.");
    }

    // get the firestore user id from the token
    const userRef = db.collection("users").where("chatToken", "==", token);
    const userSnapshot = await userRef.get();
    if (userSnapshot.empty) {
      return res.status(200).send("No user found.");
    }
    const user = userSnapshot.docs[0].account;

    // get the telegram chat id from the message
    const chat_id = message.chat.id;
    if (!chat_id) {
      return res.status(200).send("No chat id received.");
    }

    const telegram_id = message.from.id;
    if (!telegram_id) {
      return res.status(200).send("No id received.");
    }
    const userData = {
      id: telegram_id,
      chat_id: chat_id,
    };

    // Save the user ID to your Firestore or database here
    await saveUserDataToFirestore(user, userData, "telegram");

    // Send a message back to the user
    await sendTelegramMessage(chat_id, "Notifications enabled.");

    return res.status(200).send("Telegram user data saved successfully.");
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Error storing Telegram user ID.');
  }
});

async function sendTelegramMessage(chat_id, message) {

  const sendMessageUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_KEY}/sendMessage?chat_id=${chat_id}&text=${message}`;
  axios.post(sendMessageUrl)
    .then(response => {
      console.log('Message sent successfully:', response.data);
    })
    .catch(error => {
      console.error('Error sending message:', error);
    });
}

app.post("storeChatToken", async (req, res) => {
  try {
    const user = req.get("userId");
    if (!user) {
      return res.status(400).send("User id missing.");
    }
    // generate a random token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // check if user already has a token
    const userRef = db.collection("users").doc(user);
    const userData = await userRef.get();
    if (userData.exists && userData.data().chatToken) {
      return res.status(400).send("User already has a token.");
    }

    // save token to Firestore
    await saveUserDataToFirestore(user, token, "chatToken");

    return res.send("Chat token saved successfully.");
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error saving chat token.");
  }
});

app.get("getChatToken", async (req, res) => {
  try {
    const user = req.get("userId");
    if (!user) {
      return res.status(400).send("User id missing.");
    }

    const userRef = db.collection("users").doc(user);
    const userData = await userRef.get();
    if (!userData.exists || !userData.data().chatToken) {
      return res.status(400).send("User does not have a token.");
    }

    return res.send(userData.data().chatToken);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send("Error retrieving chat token.");
  }
});

app.post("/disconnectSocial", async (req, res) => {
  try {
    const user = req.get("userId");
    const { social } = req.body;

    if (!user) {
      return res.status(400).send("User id missing.");
    }

    if (!social || (social !== "telegram" && social !== "discord")) {
      return res.status(400).send("Invalid social platform specified.");
    }

    await disconnectSocialFromFirestore(user, social);

    return res.send(`${social} disconnected successfully.`);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send(`Error disconnecting ${social}.`);
  }
});

async function exchangeCodeForToken(code) {
  try {
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return tokenResponse.data;
  } catch (error) {
    throw new Error("Token exchange failed.", error);
  }
}

async function getDiscordUserData(accessToken) {
  try {
    const userResponse = await axios.get(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const avatarType = userResponse.data.avatar.startsWith("a_")
      ? "gif"
      : "png";

    return {
      id: userResponse.data.id,
      username: userResponse.data.username,
      avatar: `https://cdn.discordapp.com/avatars/${userResponse.data.id}/${userResponse.data.avatar}.${avatarType}`,
    };
  } catch (error) {
    throw new Error("Error retrieving Discord user data.", error);
  }
}

async function saveUserDataToFirestore(user, userData, social) {
  const usersRef = db.collection("users");
  try {
    await usersRef.doc(user).update({
      [`${social}`]: userData,
    });
  } catch (error) {
    console.error("Error saving ${social} user data to Firestore:", error);
  }
}

async function disconnectSocialFromFirestore(user, social) {
  const usersRef = db.collection("users");
  try {
    const updateObject = {};
    updateObject[`${social}.id`] = "x";
    await usersRef.doc(user).update(updateObject);
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Firestore update failed.");
  }
}

exports.callback = app;
