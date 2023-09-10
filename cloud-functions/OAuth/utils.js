const axios = require("axios");
const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();
const { ApiError } = require('./errors');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;

async function exchangeDiscordCodeForToken(code) {
    try {
        const response = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: DISCORD_REDIRECT_URI,
            scope: 'identify'
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    }
    catch (error) {
        throw new ApiError(500, "Error exchanging Discord code for token.", "discord");
    }
}

async function getDiscordUserData(access_token) {
    try {
        const user_response = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });
        return user_response.data;
    }
    catch (error) {
        throw new ApiError(500, "Error getting Discord user data.", "discord");
    }
}


async function sendTelegramMessage(chat_id, message) {
    const send_message_url = `https://api.telegram.org/bot${TELEGRAM_BOT_KEY}/sendMessage?chat_id=${chat_id}&text=${message}`;
    try {
        await axios.post(send_message_url);
        return "Message sent successfully.";
    } catch (error) {
        throw new ApiError(500, "Error sending telegram message.", "telegram");
    }
}

async function getFirestoreDataFromChatToken(token) {
    try {
        const user_ref = db.collection("users").where("telegram.token", "==", token);
        const user_snapshot = await user_ref.get();
        if (user_snapshot.empty) {
            throw new ApiError(404, "No user found.", "telegramWebhook");
        }
        const user_id = user_snapshot.docs[0].id;

        return user_id;
    } catch (error) {
        throw new ApiError(500, "Error getting user data from chat token.", "telegramWebhook");
    }
}

async function generateChatToken(user) {
    try {
        const user_ref = db.collection("users").doc(user);
        const user_data = await user_ref.get();

        if (user_data.exists && user_data.data().telegram && user_data.data().telegram.token != "x") {
            throw new ApiError(400, "User already has a token.", "telegram");
        }

        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        return token;
    } catch (error) {
        throw new ApiError(500, "Error generating chat token.", "telegram");
    }
}

async function getChatToken(user) {
    try {
        const user_ref = db.collection("users").doc(user);
        const user_data = await user_ref.get();

        if (!user_data.exists || !user_data.data().telegram || !user_data.data().telegram.token) {
            throw new ApiError(404, "User does not have a token.", "telegram");
        }
        return user_data.data().telegram.token;
    } catch (error) {
        throw new ApiError(500, "Error retrieving chat token.", "telegram");
    }
}

async function disconnectSocial(user, social) {
    const user_ref = db.collection("users");
    try {
        const update_object = {};
        update_object[`${social}.id`] = "x";
        // If the social platform is Discord, also clear the avatar and username
        if (social === "discord") {
            update_object[`${social}.avatar`] = "x";
            update_object[`${social}.username`] = "x";
        }
        await user_ref.doc(user).update(update_object);
        return "Social disconnected successfully.";
    } catch (error) {
        throw new ApiError(500, `Error disconnecting ${social}.`, social);
    }
}

async function saveUserDataToFirestore(user, user_data, social) {
    try {
        // check if user already has user_data saved
        const user_ref = db.collection('users').doc(user);
        const user_snapshot = await user_ref.get();
        if (user_snapshot.exists && user_snapshot.data()[social] && user_snapshot.data()[social].id != "x") {
            if (social == "telegram") {
                await sendTelegramMessage(user_snapshot.data().telegram.id, "Notifications are already enabled.");
                social = "telegramWebhook";
            }
            throw new ApiError(200, `User already has ${social} data saved.`, social);
        }

        await db.collection('users').doc(user).set({
            [social]: user_data
        }, { merge: true });

        // if successful, send telegram message
        if (social == "telegram" && user_data.id && user_data.id != "x") {
            await sendTelegramMessage(user_data.id, "Notifications enabled. Please refresh copile settings page.");
        }
    } catch (error) {
        throw new ApiError(500, `Error saving ${social} user data to firestore.`, social);
    }
}

module.exports = {
    exchangeDiscordCodeForToken,
    getDiscordUserData,
    getFirestoreDataFromChatToken,
    generateChatToken,
    getChatToken,
    disconnectSocial,
    saveUserDataToFirestore
};
