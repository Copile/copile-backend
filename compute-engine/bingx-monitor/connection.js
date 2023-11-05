require('dotenv').config();
const WebSocket = require('ws');
const zlib = require('zlib');
const createListenKey = require('./listenkey/createListenKey.js');
const extendListenKey = require('./listenkey/extendListenKey.js');
const internal = require('stream');

let socket;
let receivedMessage = "";
let path;

async function setPath() {
  path = process.env.BINGX_URL + await createListenKey();
  console.log(path);
}

const CHANNEL = {"notice:":"no need to subscribe to  any specific channel,please check the hightlight msg in the api docs"}; 

async function onOpen() {
  console.log("WebSocket connected");
  return new Promise((resolve, reject) => {
    try {
      socket.send(JSON.stringify(CHANNEL));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function onError(error) {
  console.log("WebSocket error:", error);
}

async function onMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      const buf = Buffer.from(message);
      const decodedMsg = zlib.gunzipSync(buf).toString('utf-8');
      console.log(decodedMsg);

      if (decodedMsg === "Ping") {
        socket.send('Pong');
        console.log('Pong');
      }
      receivedMessage = decodedMsg;
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function init() {
  try {
    await setPath();
    socket = new WebSocket(path);
    socket.on('open', () => onOpen());
    socket.on('message', (message) => onMessage(message));
    socket.on('error', (error) => onError(error));

    // Schedule to extend the listenKey every 5 minutes
    setInterval(async () => {
      try {
        await extendListenKey();
        console.log("ListenKey extended successfully");
      } catch (error) {
        console.log("Failed to extend ListenKey, creating a new one");
        await setPath();
        // Reconnect the WebSocket with the new key
        socket.close();
        await init();
      }
    }, 300000); // 300000 ms is 5 minutes
  } catch (error) {
    console.log('Initialization failed:', error);
  }
}

(async() => {
  await init()
})()
