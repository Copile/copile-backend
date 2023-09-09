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

// Custom error class for consistency
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Error handling middleware (should be the last one)
app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  if (err instanceof AppError) {
    res.status(err.status).send(err.message);
  } else {
    res.status(500).send("Internal Server Error");
  }
});

app.get("/callback/discord", async (req, res, next) => {
  try {
    const user = req.get("userId");
    const code = req.query.code;

    if (!code) {
      throw new AppError(400, "Code parameter missing.");
    }

    if (!user) {
      throw new AppError(400, "User id missing.");
    }

    const tokenData = await exchangeCodeForToken(code);
    const discordUserData = await getDiscordUserData(tokenData.access_token);

    await saveUserDataToFirestore(user, discordUserData, "discord");

    res.send("Discord User data saved successfully.");
  } catch (error) {
    next(error);
  }
});

app.post("/callback/telegram", async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      throw new AppError(400, "No message received.");
    }

    const token = message.text.split(" ")[1];
    if (!token) {
      throw new AppError(400, "No token received.");
    }

    const userData = await getUserDataFromToken(token);

    await saveUserDataToFirestore(userData.user_id, userData.chat_id, "telegram");

    await sendTelegramMessage(userData.chat_id, "Notifications enabled.");

    res.status(200).send("Telegram user data saved successfully.");
  } catch (error) {
    next(error);
  }
});

app.get("/storeChatToken", async (req, res, next) => {
  try {
    const user = req.get("userId");
    if (!user) {
      throw new AppError(400, "User id missing.");
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
      throw new AppError(400, "User id missing.");
    }

    const chatToken = await getChatToken(user);

    if (!chatToken) {
      throw new AppError(404, "User does not have a token.");
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
      throw new AppError(400, "User id missing.");
    }

    if (!social || (social !== "telegram" && social !== "discord")) {
      throw new AppError(400, "Invalid social platform specified.");
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
    throw new AppError(500, "Token exchange failed.");
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
    throw new AppError(500, "Error retrieving Discord user data.");
  }
}

async function saveUserDataToFirestore(user, userData, social) {
  console.log(user);
  const usersRef = db.collection("users");
  try {
    await usersRef.doc(user).update({
      [`${social}`]: userData,
    });
  } catch (error) {
    console.log(error);
    throw new AppError(500, `Error saving ${social} user data to Firestore.`);
  }
}

async function getUserDataFromToken(token) {
  try {
    const userRef = db.collection("users").where("chatToken", "==", token);
    const userSnapshot = await userRef.get();
    console.log(userSnapshot.docs[0].data());
    console.log(userSnapshot.docs[0].id);
    if (userSnapshot.empty) {
      throw new AppError(404, "No user found.");
    }

    const user_id = userSnapshot.docs[0].account;
    console.log(user_id);
    const chat_id = userSnapshot.docs[0].data().chat_id;
    return { user_id: user_id, chat_id: chat_id };
  } catch (error) {
    throw new AppError(500, "Error getting user data from token.");
  }
}

async function generateChatToken(user) {
  try {
    const userRef = db.collection("users").doc(user);
    const userData = await userRef.get();

    if (userData.exists && userData.data().chatToken) {
      throw new AppError(400, "User already has a token.");
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    return token;
  } catch (error) {
    throw new AppError(500, "Error generating chat token.");
  }
}

async function getChatToken(user) {
  try {
    const userRef = db.collection("users").doc(user);
    const userData = await userRef.get();

    if (!userData.exists || !userData.data().chatToken) {
      throw new AppError(404, "User does not have a token.");
    }

    return userData.data().chatToken;
  } catch (error) {
    throw new AppError(500, "Error retrieving chat token.");
  }
}

async function disconnectSocial(user, social) {
  const usersRef = db.collection("users");
  try {
    const updateObject = {};
    updateObject[`${social}.id`] = "x";
    await usersRef.doc(user).update(updateObject);
  } catch (error) {
    throw new AppError(500, `Error disconnecting ${social}.`);
  }
}

async function sendTelegramMessage(chat_id, message) {
  const sendMessageUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_KEY}/sendMessage?chat_id=${chat_id}&text=${message}`;
  try {
    await axios.post(sendMessageUrl);
    return "Message sent successfully.";
  } catch (error) {
    throw new AppError(500, "Error sending message.");
  }
}

exports.callback = app;
