/**
 * OTP sender via Authkey.io
 */

async function sendOTP(phone, otp) {
  const mobile  = phone.replace('+', '');
  const message = `Your IntenCiv Health OTP is ${otp}. Valid for 10 minutes. Do not share with anyone. -IntenCiv`;

  const params = new URLSearchParams({
    authkey:      process.env.AUTHKEY_API_KEY,
    mobile:       mobile,
    country_code: '91',
    sid:          process.env.AUTHKEY_WELCOME_SID,
    msg:          message,
  });

  if (process.env.AUTHKEY_TEMPLATE_SID) {
    params.append('template_id', process.env.AUTHKEY_TEMPLATE_SID);
  }

  const res  = await fetch(`https://api.authkey.io/request?${params.toString()}`);
  const data = await res.json();

  if (data.type === 'error') {
    console.error('[OTP] Authkey error:', data);
    throw new Error(`Authkey error: ${data.message || 'Unknown error'}`);
  }

  console.log(`[OTP] Sent to ${phone}, request_id: ${data.request_id || '-'}`);
  return data;
}

module.exports = { sendOTP };
