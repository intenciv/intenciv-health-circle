/**
 * authkey.io OTP delivery + welcome SMS.
 *
 * Endpoint: POST https://api.authkey.io/request
 * Params  : authkey, mobile (10 digits, no country code),
 *           country_code=91, sid (template id), otp (4-digit number),
 *           name (optional, used by the pre-approved template if needed).
 *
 * IntenCiv pre-approved template:
 *   "Your IntenCiv OTP is {otp}. Valid for 10 minutes.
 *    Do not share. - IntenCiv Diagnostics"
 */
const axios = require('axios');

const AUTHKEY_URL = 'https://api.authkey.io/request';

/**
 * Normalises +91XXXXXXXXXX or 0091XXXXXXXXXX to 10-digit local number.
 */
function toLocalMobile(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  if (digits.length === 10) return digits;
  // Last resort — take last 10.
  return digits.slice(-10);
}

async function sendOtp({ phone, otp, name = '' }) {
  const params = {
    authkey: process.env.AUTHKEY_API_KEY,
    mobile: toLocalMobile(phone),
    country_code: '91',
    sid: process.env.AUTHKEY_TEMPLATE_SID,
    otp,
  };
  if (name) params.name = name;

  const { data } = await axios.get(AUTHKEY_URL, {
    params,
    timeout: 10_000,
    validateStatus: () => true,
  });
  return data;
}

/**
 * Welcome SMS sent after booklet activation. Reuses the OTP template
 * channel (numeric "otp" field repurposed as code) ONLY if a separate
 * template SID is not configured. For production, configure a dedicated
 * SID via AUTHKEY_WELCOME_SID and we'll use that instead.
 */
async function sendWelcome({ phone, tierName, couponCount, expiresAt }) {
  const sid = process.env.AUTHKEY_WELCOME_SID || process.env.AUTHKEY_TEMPLATE_SID;
  const params = {
    authkey: process.env.AUTHKEY_API_KEY,
    mobile: toLocalMobile(phone),
    country_code: '91',
    sid,
    // Generic fields the authkey template can interpolate into.
    name: tierName || 'IntenCiv',
    otp: String(couponCount || 0),
    expiry: expiresAt instanceof Date ? expiresAt.toISOString().slice(0, 10) : '',
  };

  const { data } = await axios.get(AUTHKEY_URL, {
    params,
    timeout: 10_000,
    validateStatus: () => true,
  });
  return data;
}

module.exports = { sendOtp, sendWelcome, toLocalMobile };
