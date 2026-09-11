/**
 * Manual check for the Datagen SMS integration — no database needed.
 *
 *   node scripts/test-datagen-sms.js --dry            # print, send nothing
 *   node scripts/test-datagen-sms.js 9812345678       # send a real OTP
 *   node scripts/test-datagen-sms.js 9812345678 --welcome
 *
 * --dry prints the exact message and query string that would go to Datagen,
 * so the text can be diffed against the DLT-approved template before spending
 * a credit. Without --dry it really sends, and prints Datagen's raw reply.
 *
 * Reminder: Datagen answers {"code":"100"} as soon as it accepts the request.
 * That is NOT proof of delivery — if the text does not match the approved DLT
 * template, or the PE-TM chain is missing, the operator drops it afterwards
 * and nothing reaches the handset.
 */
require('dotenv').config();

const datagen = require('../services/datagen');

const args    = process.argv.slice(2);
const dry     = args.includes('--dry');
const welcome = args.includes('--welcome');
const phone   = args.find((a) => !a.startsWith('--'));

const OTP = '123456';

function fail(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

if (!process.env.DATAGEN_AUTH_KEY) fail('DATAGEN_AUTH_KEY is not set (backend/.env)');
if (!process.env.DATAGEN_SENDER_ID) fail('DATAGEN_SENDER_ID is not set (backend/.env)');
if (!phone && !dry) fail('Pass a mobile number, or use --dry to print without sending.');

const message = welcome
  ? datagen.fillTemplate(
      process.env.DATAGEN_WELCOME_TEMPLATE ||
        '(DATAGEN_WELCOME_TEMPLATE is unset — welcome SMS is disabled)',
      { tier: 'Gold', coupons: 8, expiry: '2027-01-01' }
    )
  : datagen.fillTemplate(
      process.env.DATAGEN_OTP_TEMPLATE ||
        'Dear Customer, your OTP for IntenCiv is {otp}. It is valid for 10 minutes. Do not share it with anyone.',
      { otp: OTP }
    );

console.log('\n  sender id : %s', process.env.DATAGEN_SENDER_ID);
console.log('  msisdn    : %s', phone ? datagen.toLocalMobile(phone) : '(none — dry run)');
console.log('  message   : %s', JSON.stringify(message));
console.log('  length    : %d chars', message.length);

if (dry) {
  console.log('\n  Compare the message above against the approved template on VILPOWER.');
  console.log('  Every character outside the variable slot must be identical.\n');
  process.exit(0);
}

(async () => {
  const result = welcome
    ? await datagen.sendWelcome({
        phone,
        tierName: 'Gold',
        couponCount: 8,
        expiresAt: new Date('2027-01-01'),
      })
    : await datagen.sendOtp({ phone, otp: OTP });

  console.log('\n  ok        : %s', result.ok);
  console.log('  code      : %s', result.code);
  console.log('  campaign  : %s', result.campaignId);
  console.log('  reply     : %s', JSON.stringify(result.raw));

  if (result.skipped) {
    console.log('\n  Skipped — DATAGEN_WELCOME_TEMPLATE is not configured.\n');
  } else if (result.ok) {
    console.log('\n  Datagen accepted it. Now check the handset — if no SMS arrives,');
    console.log('  the operator scrubbed it (template text or PE-TM chain).\n');
  } else {
    console.log('\n  Datagen rejected it. 402 invalid auth / 412 no balance /');
    console.log('  413 sender id not approved / 408 invalid sender id.\n');
  }
})().catch((e) => fail(`Request failed: ${e.message}`));
