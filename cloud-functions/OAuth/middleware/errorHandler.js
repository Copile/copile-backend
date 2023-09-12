const errorHandler = (err, req, res, next) => {
    console.log("Error handler called");
    // Check if the error is from the telegramWebhook and respond with 200.
    if (err.source === "telegramWebhook") {
      req.logger.info("telegramWebhook");
      res.status(200).send('OK'); // Send a response to Telegram with a 200 status code
    } else {
    req.logger.error(`Error from ${err.source || 'Unknown source'}: ${err.message}`);
      req.logger.info("normal error");
      res.status(err.status || 500).send(err.message || 'Internal Server Error');
    }
  };
  
  module.exports = errorHandler;
  