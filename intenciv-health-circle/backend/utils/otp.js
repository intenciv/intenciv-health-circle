/**
 * OTP sender via Datagen.
 *
 * Thin wrapper over services/datagen.js that throws on a failed send, because
 * the customer-login route treats an undelivered OTP as a hard error.
 */
const datagen = require('../services/datagen');

async function sendOTP(phone, otp) {
  const result = await datagen.sendOtp({ phone, otp });

  if (!result.ok) {
    throw new Error(`Datagen error: ${result.message || 'Unknown error'}`);
  }

  console.log(`[OTP] Sent to ${phone}, campaign_id: ${result.campaignId || '-'}`);
  return result;
}

module.exports = { sendOTP };
