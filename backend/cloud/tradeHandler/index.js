const bodyParser = require("body-parser");
const express = require("express");

const app = express();
app.enable("trust proxy");

app.use(bodyParser.raw({type: "application/octet-stream"}));


app.get("/", (req, res) => {
    res.send("Hello world").end();
});

app.post("/trade", (req, res) => {
    console.log("Received trade:", req.body);
    console.log(req.body);

    res.send(JSON.stringify({handled: true}));
});

app.get("*", (req, res) => {
    res.send("OK").end();
});




const PORT = process.env.PORT || 8080;
app.listen(process.env.PORT || 8080, () => {
  console.log(`tradeHandler listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});