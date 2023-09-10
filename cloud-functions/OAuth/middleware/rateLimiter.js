const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    keyGenerator: (req) => {
        const user_id = req.get('userId') || 'no_user';
        return user_id;
    },
});

module.exports = limiter;