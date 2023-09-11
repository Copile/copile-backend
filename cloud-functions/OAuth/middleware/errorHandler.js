const errorHandler = (err, req, res, next) => {
    req.logger.error(`Error from ${err.source || 'Unknown source'}: ${err.message}`);
    console.log(err);
    req.logger.info(err.stack);
    // Check if the error is from the telegramWebhook and respond with 200.
    if (err.source === "telegramWebhook") {
      console.log("telegramWebhook");
      return res.status(200).send('OK'); // Send a response to Telegram with a 200 status code
    }
  
    console.log("normal error");
    res.status(err.status || 500).send(err.message || 'Internal Server Error');
  };
  
  module.exports = errorHandler;
  