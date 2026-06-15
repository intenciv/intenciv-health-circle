/**
 * authkey.io OTP delivery + verification (2FA SID-based template).
 *
 * Send : GET https://api.authkey.io/request
 *          params: authkey, mobile (10-digit), country_code=91, sid (template id)
 *          → AuthKey generates its own OTP and returns { LogID, Message }
 *
 * Verify: GET https://console.authkey.io/api/2fa_verify.php
 *          params: authkey, channel=SMS, otp (entered by user), logid (from send)
 *          → { status: true/false, message }
 *
 * IMPORTANT: AuthKey generates the OTP itself — we never generate or
 * store our own OTP value. We store the LogID and verify against it.
 */
const axios = require('axios');
const AUTHKEY_REQUEST_URL = 'https://api.authkey.io/request';
const AUTHKEY_VERIFY_URL  = 'https://console.authkey.io/api/2fa_verify.php';

/**
 * Normalises +91XXXXXXXXXX or 0091XXXXXXXXXX to 10-digit local number.
 */
function toLocalMobile(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  if (digits.length === 10) return digits;
  return digits.slice(-10);
}

/**
 * Sends an OTP via the approved 2FA template. AuthKey generates the OTP
 * and returns a LogID used later to verify the customer's entry.
 * Returns: { LogID, Message } on success.
 */
async function sendOtp({ phone }) {
  const params = {
    authkey: process.env.AUTHKEY_API_KEY,
    mobile: toLocalMobile(phone),
    country_code: '91',
    sid: process.env.AUTHKEY_TEMPLATE_SID,
  };
  const { data } = await axios.get(AUTHKEY_REQUEST_URL, {
    params,
    timeout: 10_000,
    validateStatus: () => true,
  });
  return data;
}

/**
 * Verifies a customer-entered OTP against the LogID returned by sendOtp.
 * Returns: { status: true|false, message }.
 */
async function verifyOtp({ otp, logId }) {
  const params = {
    authkey: process.env.AUTHKEY_API_KEY,
    channel: 'SMS',
    otp: String(otp),
    logid: logId,
  };
  const { data } = await axios.get(AUTHKEY_VERIFY_URL, {
    params,
    timeout: 10_000,
    validateStatus: () => true,
  });
  return data;
}

/**
 * Welcome SMS sent after card activation. Uses a separate template SID.
 * If that template has its own placeholders (name/otp/expiry), AuthKey
 * will substitute them — adjust params here to match your approved
 * welcome template's variables.
 */
async function sendWelcome({ phone, tierName, couponCount, expiresAt }) {
  const sid = process.env.AUTHKEY_WELCOME_SID || process.env.AUTHKEY_TEMPLATE_SID;
  const params = {
    authkey: process.env.AUTHKEY_API_KEY,
    mobile: toLocalMobile(phone),
    country_code: '91',
    sid,
    name: tierName || 'IntenCiv',
    otp: String(couponCount || 0),
    expiry: expiresAt instanceof Date ? expiresAt.toISOString().slice(0, 10) : '',
  };
  const { data } = await axios.get(AUTHKEY_REQUEST_URL, {
    params,
    timeout: 10_000,
    validateStatus: () => true,
  });
  return data;
}

module.exports = { sendOtp, verifyOtp, sendWelcome, toLocalMobile };
