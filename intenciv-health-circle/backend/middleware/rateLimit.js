/**
 * Rate limiters.
 *  - generalLimiter : 100 req / minute / IP   (spec)
 *  - otpLimiter     : 3 OTP sends / hour / phone (spec)
 *
 * The phone-keyed limiter uses req.body.phone as the key, so it must
 * run AFTER express.json().
 */
const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.phone || req.ip),
  message: { error: 'otp_rate_limited', detail: 'Maximum 3 OTPs per hour per phone.' },
});

module.exports = { generalLimiter, otpLimiter };
