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
const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).send(err.message);
});

app.get("/callback/discord", async (req, res, next) => {
  try {
    const user = req.get("userId");
    const code = req.query.code;

    if (!code) {
      throw { status: 400, message: "Code parameter missing." };
    }

    if (!user) {
      throw { status: 400, message: "User id missing." };
    }

    const tokenData = await exchangeCodeForToken(code);
    const discordUserData = await getDiscordUserData(tokenData.access_token);

    await saveUserDataToFirestore(user, discordUserData, "discord");

    res.send("Discord User data saved successfully.");
  } catch (error) {
    next(error); // Pass the error to the error handler middleware
  }
});

app.post("/callback/telegram", async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      throw { status: 400, message: "No message received." };
    }

    const token = message.text.split(" ")[1];
    if (!token) {
      throw { status: 400, message: "No token received." };
    }

    // Get the Firestore user id from the token
    const userData = await getUserDataFromToken(token);

    // Save the userData to Firestore
    await saveUserDataToFirestore(userData.user_id, message.chat, "telegram");

    // Send a message back to the user
    await sendTelegramMessage(message.chat.id, "Notifications enabled.");

    res.status(200).send("Telegram user data saved successfully.");
  } catch (error) {
    next(error);
  }
});

app.post("/storeChatToken", async (req, res, next) => {
  try {
    const user = req.get("userId");
    if (!user) {
      throw { status: 400, message: "User id missing." };
    }

    const token = await generateChatToken(user);

    await saveUserDataToFirestore(user, token, "chatToken");

    res.send("Chat token saved successfully.");
  } catch (error) {
    next(error);
  }
});

app.get("/getChatToken", async (req, res, next) => {
  try {
    const user = req.get("userId");
    if (!user) {
      throw { status: 400, message: "User id missing." };
    }

    const chatToken = await getChatToken(user);

    if (!chatToken) {
      throw { status: 404, message: "User does not have a token." };
    }

    res.send(chatToken);
  } catch (error) {
    next(error);
  }
});

app.post("/disconnectSocial", async (req, res, next) => {
  try {
    const user = req.get("userId");
    const { social } = req.body;

    if (!user) {
      throw { status: 400, message: "User id missing." };
    }

    if (!social || (social !== "telegram" && social !== "discord")) {
      throw { status: 400, message: "Invalid social platform specified." };
    }

    await disconnectSocial(user, social);

    res.send(`${social} disconnected successfully.`);
  } catch (error) {
    next(error);
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
    throw { status: 500, message: "Token exchange failed." };
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
    throw { status: 500, message: "Error retrieving Discord user data." };
  }
}

async function saveUserDataToFirestore(user, userData, social) {
  const usersRef = db.collection("users");
  try {
    await usersRef.doc(user).update({
      [`${social}`]: userData,
    });
  } catch (error) {
    throw { status: 500, message: `Error saving ${social} user data to Firestore.` };
  }
}

async function getUserDataFromToken(token) {
  try {
    const userRef = db.collection("users").where("chatToken", "==", token);
    const userSnapshot = await userRef.get();

    if (userSnapshot.empty) {
      throw { status: 404, message: "No user found." };
    }

    const user_id = userSnapshot.docs[0].account;
    const chat_id = userSnapshot.docs[0].data().chat_id;
    return { user_id: user_id, chat_id: chat_id };
  } catch (error) {
    throw { status: 500, message: "Error getting user data from token." };
  }
}

async function generateChatToken(user) {
  try {
    const userRef = db.collection("users").doc(user);
    const userData = await userRef.get();

    if (userData.exists && userData.data().chatToken) {
      throw { status: 400, message: "User already has a token." };
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    return token;
  } catch (error) {
    throw { status: 500, message: "Error generating chat token." };
  }
}

async function getChatToken(user) {
  try {
    const userRef = db.collection("users").doc(user);
    const userData = await userRef.get();

    if (!userData.exists || !userData.data().chatToken) {
      throw { status: 404, message: "User does not have a token." };
    }

    return userData.data().chatToken;
  } catch (error) {
    throw { status: 500, message: "Error retrieving chat token." };
  }
}

async function disconnectSocial(user, social) {
  const usersRef = db.collection("users");
  try {
    const updateObject = {};
    updateObject[`${social}.id`] = "x";
    await usersRef.doc(user).update(updateObject);
  } catch (error) {
    throw { status: 500, message: `Error disconnecting ${social}.` };
  }
}

async function sendTelegramMessage(chat_id, message) {

  const sendMessageUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_KEY}/sendMessage?chat_id=${chat_id}&text=${message}`;
  try{
    await axios.post(sendMessageUrl);
    res.send("Message sent successfully.");
  }
  catch(error){
    throw { status: 500, message: `Error sending message.` };
  }
}
exports.callback = app;
