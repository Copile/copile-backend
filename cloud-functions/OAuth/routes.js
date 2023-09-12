const express = require("express");
const { ApiError } = require('./errors');
const { exchangeDiscordCodeForToken,
    getDiscordUserData,
    getFirestoreDataFromChatToken,
    generateChatToken,
    getChatToken,
    disconnectSocial,
    saveUserDataToFirestore } = require('./utils');

const router = express.Router();

router.get("/callback/discord", async (req, res, next) => {
    try {
        const user = req.get("userId");
        const code = req.query.code;

        if (!code) {
            throw new ApiError(400, "Code parameter missing.", "discord");
        }

        if (!user) {
            throw new ApiError(400, "User id missing.", "discord");
        }

        const token_data = await exchangeDiscordCodeForToken(code);
        const discord_user_data = await getDiscordUserData(token_data.access_token);

        await saveUserDataToFirestore(user, discord_user_data, "discord");

        res.status(200).send("Discord User data saved successfully.");
    } catch (error) {
        next(error);
    }
});

router.post("/callback/telegram", async (req, res, next) => {
    try {
        const { message } = req.body;
        if (!message) {
            res.status(200).send("No message received.");
            throw new ApiError(400, "No message received.", "telegramWebhook");
        }

        if (!message.text.startsWith("/start")) {
            res.status(200).send("Invalid Command.");
            throw new ApiError(400, "Invalid command.", "telegramWebhook");
        }

        const token = message.text.split(" ")[1];
        if (!token || token.length != 16) {
            res.status(200).send("No token or invalid token received.");
            throw new ApiError(400, "No token or invalid received.", "telegramWebhook");
        }

        const user_id = await getFirestoreDataFromChatToken(token, res);

        const chat_id = message.chat.id;

        await saveUserDataToFirestore(user_id, { id: chat_id }, "telegram");

        res.status(200).send("Telegram User data saved successfully.");
    } catch (error) {
        next(error);
    }
});

router.get("/storeChatToken", async (req, res, next) => {
    try {
        const user = req.get("userId");
        if (!user) {
            throw new ApiError(400, "User id missing.", "telegram");
        }

        const token = await generateChatToken(user);

        await saveUserDataToFirestore(user, { token: token }, "telegram");

        res.status(200).send("Chat token saved successfully.");
    } catch (error) {
        next(error);
    }
});

router.get("/getChatToken", async (req, res, next) => {
    try {
        const user = req.get("userId");
        if (!user) {
            throw new ApiError(400, "User id missing.", "telegram");
        }

        const chat_token = await getChatToken(user);

        if (!chat_token) {
            throw new ApiError(404, "User token not found.", "telegram");
        }

        res.status(200).send(chat_token);
    } catch (error) {
        next(error);
    }
});

router.post("/disconnectSocial", async (req, res, next) => {
    try {
        const user = req.get("userId");
        const { social } = req.body;

        if (!user) {
            throw new ApiError(400, "User id missing.", social);
        }

        if (!social || (social !== "telegram" && social !== "discord")) {
            throw new ApiError(400, "Invalid social platform specified.", social);
        }

        await disconnectSocial(user, social);

        res.status(200).send(`${social} disconnected successfully.`);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
