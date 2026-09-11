/**
 * Datagen SMS delivery.
 *
 * Send : GET https://global.datagenit.com/API/sms-api.php
 *          auth        user auth key                          (required)
 *          msisdn      10-digit, no country prefix            (required)
 *          senderid    6-char approved DLT header             (required)
 *          message     full text, variables already filled    (required)
 *          countrycode defaults to 91                         (optional)
 *          type        1 for unicode, 0/absent for English    (optional)
 *          entity_id   DLT principal entity id                (optional*)
 *          template_id DLT content template id                (optional)
 *        * entity_id is mandatory only if no PE id is saved in the Datagen
 *          portal, or if several are saved and one must be chosen. template_id
 *          is always optional — Datagen best-matches the text against saved
 *          templates — but their docs recommend sending it "for better
 *          results", so both are sent whenever configured.
 *
 *          → {"status":"success","validcnt":1,"campg_id":22,"code":"100","ts":"..."}
 *          → {"status":"failure","code":413,"desc":"Sender Id Not Approved","ts":"..."}
 *            401 No Auth              405 missing type parameter
 *            402 Invalid Auth         406 Message Not Passed
 *            407 Access Denied (source IP not whitelisted on the account)
 *            408 Invalid Sender ID    410 Msisdn Not Passed
 *            411 MSISDN Limit Exceed  412 Insufficient Balance
 *            413 Sender Id Not Approved
 *            414 Given country not active for your account
 *            420 Entity ID not found
 *          Codes do not match the published list: a bad key on this endpoint
 *          was observed returning 412 "Invalid Auth or inactive user", though
 *          the docs list 412 as "Insufficient Balance". Failures are therefore
 *          surfaced with Datagen's own `desc` rather than mapped to local
 *          text. `code` is a string on success and a number on failure, so it
 *          is always compared as a string.
 *
 * NOT USED — Datagen's 2Factor pair (generate_otp.php / verify_otp.php), which
 * mirrors the AuthKey LogID model this replaces. Their docs: "This api send
 * only one template fixed by backend for every account", i.e. a generic body
 * that is not registered under our PE id and would be scrubbed by the
 * operator; using our own wording needs a support request to Datagen. It also
 * fixes OTP validity at 5 minutes, while our templates and the
 * /activation/send-otp contract both promise 10. So we keep generating and
 * verifying OTPs ourselves: the OTP's SHA-256 hash goes to otp_log, and the id
 * Datagen returns is kept in otp_log.log_id for delivery traceability only.
 *
 * DLT: the sender id and the message text must match a template already
 * approved on the DLT portal (VILPOWER) under our own PE id, mirrored into
 * Datagen's DLT Setting > Manage Templates, with Datagen attached as
 * telemarketer in the PE-TM chain. Approved text is rigid — only the {#var#}
 * slots may change — so the message bodies live in env vars
 * (DATAGEN_OTP_TEMPLATE / DATAGEN_WELCOME_TEMPLATE) and must be kept
 * character-identical to the approved template.
 */
const axios = require('axios');

const DATAGEN_SMS_URL =
  process.env.DATAGEN_API_URL || 'https://global.datagenit.com/API/sms-api.php';

// DLT template 1107177701079148572 "OTP Booking OR Login" (header INTCIV,
// transactional, PE 1101585970000092735), verified against VILPOWER:
//   Dear Customer, your OTP for IntenCiv is {#num#}. It is valid for 10 minutes. Do not share it with anyone.
// Reproduced exactly, with {otp} in place of the {#num#} slot. Do not reword —
// the operator matches on content and silently scrubs anything that differs.
// {#num#} is numeric-typed, so whatever fills it must stay digits-only.
const DEFAULT_OTP_TEMPLATE =
  'Dear Customer, your OTP for IntenCiv is {otp}. It is valid for 10 minutes. Do not share it with anyone.';
const DEFAULT_OTP_TEMPLATE_ID = '1107177701079148572';

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
 * Fills {placeholder} slots in an approved template body.
 */
function fillTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}

/**
 * Datagen answers 200 for failures too, so success is read off the body:
 * status "success" (code "100"). Returns { ok, code, campaignId, message, raw }.
 */
function parseResponse(data) {
  const body = typeof data === 'string' ? { status: data } : data || {};
  const ok = body.status === 'success' || String(body.code) === '100';
  return {
    ok,
    code: body.code != null ? String(body.code) : null,
    // sms-api.php returns campg_id; api.datagenit.com/sms returns logid instead.
    campaignId:
      body.campg_id != null ? String(body.campg_id)
      : body.logid != null ? String(body.logid)
      : null,
    message: body.desc || body.description || body.message || body.status || '',
    raw: body,
  };
}

/**
 * Sends one SMS. Never throws on a gateway-level failure — callers decide
 * whether a bad `ok` is fatal.
 */
async function sendSms({ phone, message, templateId, unicode = false }) {
  const params = {
    auth: process.env.DATAGEN_AUTH_KEY,
    senderid: process.env.DATAGEN_SENDER_ID,
    // With countrycode present the docs are explicit: "don't include country
    // code with mobile number" — so msisdn stays 10-digit.
    msisdn: toLocalMobile(phone),
    message,
    countrycode: process.env.DATAGEN_COUNTRY_CODE || '91',
  };
  if (unicode) params.type = '1';

  // Both optional; sent when known so Datagen resolves the DLT template
  // explicitly instead of falling back to its best-match on message text.
  if (process.env.DATAGEN_ENTITY_ID) params.entity_id = process.env.DATAGEN_ENTITY_ID;
  if (templateId) params.template_id = templateId;

  const { data } = await axios.get(DATAGEN_SMS_URL, {
    params,
    timeout: 10_000,
    validateStatus: () => true,
  });

  const result = parseResponse(data);
  if (!result.ok) {
    console.error('[SMS] Datagen send failed:', result.code, result.message, result.raw);
  }
  return result;
}

/**
 * Sends an OTP we generated ourselves, using the approved OTP template.
 * Returns { ok, code, campaignId, message, raw }.
 */
async function sendOtp({ phone, otp }) {
  const template = process.env.DATAGEN_OTP_TEMPLATE || DEFAULT_OTP_TEMPLATE;
  return sendSms({
    phone,
    message: fillTemplate(template, { otp }),
    templateId: process.env.DATAGEN_OTP_TEMPLATE_ID || DEFAULT_OTP_TEMPLATE_ID,
  });
}

/**
 * Welcome SMS sent after card activation.
 *
 * There is deliberately no default body: no welcome template has been approved
 * on DLT yet, and inventing one only produces messages the operator scrubs
 * while still costing a credit. Stays a no-op until DATAGEN_WELCOME_TEMPLATE
 * is set to an approved template's exact text.
 */
async function sendWelcome({ phone, tierName, couponCount, expiresAt }) {
  const template = process.env.DATAGEN_WELCOME_TEMPLATE;
  if (!template) {
    console.warn('[SMS] Welcome SMS skipped: DATAGEN_WELCOME_TEMPLATE not configured');
    return { ok: false, skipped: true, code: null, campaignId: null, message: 'not_configured', raw: null };
  }
  const message = fillTemplate(template, {
    tier: tierName || 'IntenCiv',
    coupons: couponCount || 0,
    expiry: expiresAt instanceof Date ? expiresAt.toISOString().slice(0, 10) : '',
  });
  return sendSms({ phone, message, templateId: process.env.DATAGEN_WELCOME_TEMPLATE_ID });
}

module.exports = { sendSms, sendOtp, sendWelcome, toLocalMobile, fillTemplate };
