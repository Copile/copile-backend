require('dotenv').config();
const WebSocket = require('ws');
const zlib = require('zlib');
const createListenKey = require('./listenkey/createListenKey.js');
const extendListenKey = require('./listenkey/extendListenKey.js');

let socket;
let receivedMessage = "";
let path;

async function setPath() {
  path = process.env.BINGX_URL + await createListenKey();
}

const CHANNEL = {"notice:":"no need to subscribe to any specific channel,please check the highlight msg in the api docs"};

function init() {
  setPath().then(() => {
    socket = new WebSocket(path);
    socket.on('open', onOpen);
    socket.on('message', onMessage);
    socket.on('error', onError);

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
        init();
      }
    }, 300000); // 300000 ms is 5 minutes
  });
}

function onOpen() {
  console.log("WebSocket connected");
  socket.send(JSON.stringify(CHANNEL));
}

function onError(error) {
  console.log("WebSocket error:", error);
}

function onMessage(message) {
  const buf = Buffer.from(message);
  const decodedMsg = zlib.gunzipSync(buf).toString('utf-8');
  console.log(decodedMsg);

  if (decodedMsg === "Ping") {
    socket.send('Pong');
    console.log('Pong');
  }
  receivedMessage = decodedMsg;
}

init();
