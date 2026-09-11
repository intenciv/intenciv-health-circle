# Migrating from AuthKey to Datagen SMS — implementation brief

Self-contained handoff for replacing an **authkey.io** SMS/OTP integration with
**Datagen** (datagenit.com) in an Indian (DLT-regulated) Node.js backend.
Everything below was verified against Datagen's developer portal and one live
API call. Written for an agent with no prior context on this migration.

Org specifics referenced throughout (substitute if yours differ):

| Thing | Value |
|---|---|
| DLT operator portal | VILPOWER (vilpower.in), TSP Vodafone Idea |
| Principal Entity (PE) ID | `1101585970000092735` — INTENCIV HEALTHCARE SERVICES PRIVATE LIMITED |
| Sender ID / header | `INTCIV` |

---

## 1. The headline: Datagen is a plain SMS pipe

AuthKey's 2FA API generated the OTP itself, returned a `LogID`, and verified the
user's entry for you. **Do not assume Datagen works that way.** Under the
recommended approach, your backend must:

1. Generate the OTP itself (e.g. 6 random digits)
2. Store its hash (SHA-256) with an expiry
3. Send the fully-rendered message text through Datagen
4. Verify the user's entry against the stored hash — **no gateway call**

If the old code stored `LogID` and called an AuthKey verify endpoint, that
entire round trip disappears. Verification becomes a local hash comparison.

### There IS a 2Factor API — do not use it

Datagen's developer portal documents `generate_otp.php` / `verify_otp.php`,
which mirror AuthKey's LogID model. It is tempting because it is a near
drop-in. Reject it for two documented reasons:

- *"This api send only one template fixed by backend for every account."* The
  default body is Datagen's own generic text, which is **not registered under
  your PE ID** and will be scrubbed by the operator. Using your own approved
  wording requires emailing Datagen support to configure it per-account.
- It fixes OTP validity at **5 minutes**. If your approved template text or API
  contract promises 10, you have an unfixable mismatch.

Generating OTPs locally has neither dependency and keeps OTP lifetime under
your control. (For reference if you ever reconsider: `generate_otp.php` takes
`auth`, `msisdn`, `senderid`, `entity_id`, `template_id` and returns
`{"status":"success","logid":"5feb7b51aca0d","desc":"OTP Sent","code":100}`;
`verify_otp.php` takes `auth`, `msisdn`, `logid`, `otp` and returns
`{"status":"success","code":200,"desc":"OTP verified successfully"}`, with
failures 419 invalid otp / 421 OTP time limit exceeded / 422 already verified.)

---

## 2. Send SMS API

```
GET https://global.datagenit.com/API/sms-api.php
```

| Param | Required | Notes |
|---|---|---|
| `auth` | yes | Auth key from Datagen portal's HTTP API section |
| `msisdn` | yes | Comma-separated, max 1000. **10-digit, no country prefix**, when `countrycode` is sent |
| `senderid` | yes | 6-char approved DLT header (India); 10-char international |
| `message` | yes | Full text, variables already substituted |
| `countrycode` | no | Defaults to 91. Docs: *"don't include country code with mobile number"* |
| `type` | no | `1` for unicode, `0`/absent for English |
| `entity_id` | no* | DLT PE ID. *Mandatory if no PE ID is saved in the Datagen portal, or if several are saved |
| `template_id` | no | DLT content template ID. Optional — Datagen best-matches on message text — but their docs *"suggest you use this parameter for better results"* |

Note the **underscores**: `entity_id` and `template_id`, not `entityid`.

Datagen's public marketing docs carry a misleading note, *"pass either voiceid
or templateid"*, implying `templateid` selects a stored campaign template that
replaces `message`. The developer portal contradicts this — `template_id` is
the DLT template ID and coexists with `message`. Trust the developer portal.

Alternate endpoints exist (`https://api.datagenit.com/sms`, and
`http://sms.datagenit.in/API/sms-api.php` for clients stuck on old TLS). Keep
the base URL configurable.

### Responses

Datagen returns **HTTP 200 even on failure.** Success must be read from the
body, or you will report "OTP sent" when nothing was delivered.

```json
{"status":"success","validcnt":1,"campg_id":22,"code":"100","ts":"2018-11-21 13:23:19"}
{"status":"failure","code":413,"desc":"Sender Id Not Approved","ts":"2018-11-20 12:56:45"}
```

Two traps:

- **`code` is a string (`"100"`) on success but a number (`413`) on failure.**
  Always coerce before comparing.
- **The success ID field differs by endpoint**: `sms-api.php` returns
  `campg_id`; `api.datagenit.com/sms` returns `logid`. Handle both.

Documented failure codes: 401 No Auth · 402 Invalid Auth · 405 missing type
parameter · 406 Message Not Passed · 407 Access Denied (source IP not
whitelisted) · 408 Invalid Sender ID · 410 Msisdn Not Passed · 411 MSISDN Limit
Exceed · 412 Insufficient Balance · 413 Sender Id Not Approved · 414 Given
country not active · 420 Entity ID not found.

**These codes are unreliable.** A live call with a bad key returned
`412 "Invalid Auth or inactive user"`, though the docs list 412 as
"Insufficient Balance". Log Datagen's own `desc` verbatim rather than mapping
codes to your own strings.

---

## 3. The DLT model — matching is by CONTENT, not by ID

This is the part most likely to be misunderstood, and the cause of "the API
says success but no SMS arrives".

Nothing in the request tells the operator *which* approved template you used
(`template_id` only helps Datagen pick internally). Instead:

1. You send the finished text, with variables already substituted.
2. The operator's DLT scrubber looks at the **sender ID**, pulls every template
   approved for that header under your PE ID, and compares your text against
   them, treating `{#var#}` positions as wildcards.
3. Match → delivered. No match → **silently dropped**. No error, no refund.

Consequences for the code:

- The message body must be **character-identical** to the approved template.
  One reworded phrase, one missing full stop, and every message vanishes.
- Therefore: **never build message text ad-hoc in code.** Put each body in an
  env var (or a constant with a comment citing the DLT template ID), with a
  clear warning not to edit the wording.
- AuthKey hid this. Its `sid` param selected a template stored on AuthKey's
  side, so whatever text your code passed was ignored. Migrating to Datagen
  makes your local text the payload for the first time — **any legacy
  free-text message string in the old code is almost certainly wrong and will
  be scrubbed.** Verify each one against the DLT portal before shipping.

### Template variable notation

The DLT portal shows `{#var#}`, or typed variants like `{#num#}` (numeric
only). AuthKey's console renders OTP slots as `{#2fa#}`. These are all the same
placeholder and **never appear in the sent message**. Use your own placeholder
convention in code (e.g. `{otp}`) and substitute before sending. If the slot is
`{#num#}`, whatever fills it must be digits-only.

### Portal setup (one-time, outside the code)

1. **DLT portal (VILPOWER):** attach the header + templates to **Datagen as
   telemarketer** in the PE-TM chain. Templates approved for a previous
   aggregator (AuthKey) will be scrubbed until this is done. This is a mapping
   change, not a re-approval — template text is unchanged.
2. **Datagen portal → DLT Setting → Manage Templates:** mirror each approved
   template. Paste the existing PE ID, the 19-digit DLT template ID, and the
   exact approved text. You are **not** creating new templates — Datagen cannot
   approve DLT templates, only operators can.
   - Leaving Sender ID unselected makes the template valid for all approved headers.
   - **Type:** choose **Service Implicit** for OTPs. Since 2021, `Transactional`
     is reserved for banks and won't be offered to non-bank accounts.
     `Promotional` is **blocked on DND numbers**, so choosing it silently loses
     a large share of OTP traffic.
3. **Unicode:** leave off for plain English. It switches GSM-7 → UCS-2, cutting
   the per-segment limit from 160 to 70 chars, which can double the cost of a
   ~104-char OTP with no benefit.

### ⚠ Verify templates actually exist on DLT

AuthKey's template list is **AuthKey's own storage**. Creating a template there
does *not* register it on DLT. Before migrating, list every template the old
code sends and confirm each has a counterpart on the DLT portal under your PE
ID. In this organisation's audit, 5 of 6 AuthKey templates had **no** VILPOWER
counterpart — and two of them had byte-identical text, which DLT would reject
as a duplicate under the same header. Those messages were very likely already
being scrubbed in production without anyone noticing.

Any message type with no approved template should **skip sending** with a
warning, not fall back to invented text — invented text is scrubbed but still
costs a credit.

---

## 4. Reference implementation

Drop-in service module (Node, axios). Adapt names/templates to your project.

```js
/**
 * Datagen SMS delivery. See docs for the full API contract.
 * Datagen is a plain message pipe: it neither generates nor verifies OTPs.
 */
const axios = require('axios');

const DATAGEN_SMS_URL =
  process.env.DATAGEN_API_URL || 'https://global.datagenit.com/API/sms-api.php';

// DLT template <ID> "<name>" (header INTCIV, PE 1101585970000092735).
// Text reproduced EXACTLY as approved, with {otp} in place of the {#num#} slot.
// Do not reword — the operator matches on content and silently scrubs anything
// that differs. {#num#} is numeric-typed, so its filler must stay digits-only.
const DEFAULT_OTP_TEMPLATE =
  'Dear Customer, your OTP for IntenCiv is {otp}. It is valid for 10 minutes. Do not share it with anyone.';
const DEFAULT_OTP_TEMPLATE_ID = '1107177701079148572';

/** Normalises +91XXXXXXXXXX / 0091XXXXXXXXXX to a 10-digit local number. */
function toLocalMobile(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  if (digits.length === 10) return digits;
  return digits.slice(-10);
}

/** Fills {placeholder} slots in an approved template body. */
function fillTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}

/**
 * Datagen answers HTTP 200 for failures too, so success is read off the body.
 * `code` is a string on success, a number on failure — always compare as string.
 */
function parseResponse(data) {
  const body = typeof data === 'string' ? { status: data } : data || {};
  const ok = body.status === 'success' || String(body.code) === '100';
  return {
    ok,
    code: body.code != null ? String(body.code) : null,
    // sms-api.php returns campg_id; api.datagenit.com/sms returns logid.
    campaignId:
      body.campg_id != null ? String(body.campg_id)
      : body.logid != null ? String(body.logid)
      : null,
    message: body.desc || body.description || body.message || body.status || '',
    raw: body,
  };
}

/** Sends one SMS. Never throws on gateway failure — callers decide severity. */
async function sendSms({ phone, message, templateId, unicode = false }) {
  const params = {
    auth: process.env.DATAGEN_AUTH_KEY,
    senderid: process.env.DATAGEN_SENDER_ID,
    // Docs: "don't include country code with mobile number" when countrycode is sent.
    msisdn: toLocalMobile(phone),
    message,
    countrycode: process.env.DATAGEN_COUNTRY_CODE || '91',
  };
  if (unicode) params.type = '1';
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

async function sendOtp({ phone, otp }) {
  const template = process.env.DATAGEN_OTP_TEMPLATE || DEFAULT_OTP_TEMPLATE;
  return sendSms({
    phone,
    message: fillTemplate(template, { otp }),
    templateId: process.env.DATAGEN_OTP_TEMPLATE_ID || DEFAULT_OTP_TEMPLATE_ID,
  });
}

module.exports = { sendSms, sendOtp, toLocalMobile, fillTemplate };
```

### Route-level change (the AuthKey LogID flow)

Before — gateway owns the OTP:

```js
const gw = await authkey.sendOtp({ phone });          // AuthKey generates OTP
if (!gw || !gw.LogID) return res.status(502).json({ error: 'otp_gateway_failed' });
await db.insert({ phone, otp_hash: '', log_id: gw.LogID, expires_at });
// ...later
const v = await authkey.verifyOtp({ otp: req.body.otp, logId: row.log_id });
if (!v || v.status !== true) { /* wrong OTP */ }
```

After — we own the OTP:

```js
const otp     = Math.floor(100000 + Math.random() * 900000).toString();
const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

const gw = await datagen.sendOtp({ phone, otp });
if (!gw.ok) return res.status(502).json({ error: 'otp_gateway_failed', details: gw.raw });
await db.insert({ phone, otp_hash: otpHash, log_id: gw.campaignId, expires_at });
// ...later
const hash = crypto.createHash('sha256').update(String(req.body.otp)).digest('hex');
if (!row.otp_hash || hash !== row.otp_hash) { /* wrong OTP */ }
```

Keep existing attempt counters, expiry checks, and rate limits — they are
unaffected. Keep route contracts and error codes identical so clients need no
change. Reuse the existing `log_id` column for `campaignId` (traceability only)
— **no schema migration needed**.

---

## 5. Environment variables

```bash
DATAGEN_AUTH_KEY=            # required — Datagen portal, HTTP API section
DATAGEN_SENDER_ID=INTCIV     # required — 6-char approved DLT header
DATAGEN_ENTITY_ID=1101585970000092735   # optional if one PE ID saved in portal
DATAGEN_COUNTRY_CODE=91      # optional, defaults to 91
DATAGEN_API_URL=             # optional, override endpoint

# Message bodies — MUST match the DLT-approved text character for character.
# Only the {placeholder} slots may vary. Any reword is silently scrubbed.
DATAGEN_OTP_TEMPLATE=
DATAGEN_OTP_TEMPLATE_ID=

# Any message type with no approved DLT template: leave unset so it is skipped
# rather than sent as invented text that gets scrubbed while costing a credit.
```

Remove all `AUTHKEY_*` variables when done.

---

## 6. Testing

Ship a standalone script that needs no database, since the risky part (auth
key, sender ID, DLT match) is independent of app state:

- `--dry` mode printing the exact message and length, to diff against the
  approved template before spending a credit.
- A real-send mode taking a phone number, printing Datagen's raw reply.

Interpreting results:

| Result | Meaning |
|---|---|
| `ok: false` | Datagen rejected it — read `desc` (402 bad key, 412 balance/auth, 413 sender not approved) |
| `ok: true`, SMS arrives | Working |
| `ok: true`, **no SMS** | Operator scrubbed it. Template text mismatch, missing Datagen mirror, or missing PE-TM chain. **Not a code bug.** |

When unit-testing the service, stub the HTTP client via `require.cache` (or
your test runner's mocking) rather than `NODE_PATH` — a stray real request to a
live SMS gateway is easy to trigger by accident.

---

## 7. Gotchas checklist

- [ ] HTTP 200 on failure — parse the body, never trust the status code
- [ ] `code` type drift: string on success, number on failure
- [ ] `campg_id` vs `logid` depending on endpoint
- [ ] `entity_id` / `template_id` use underscores
- [ ] Message text must be character-identical to the DLT template
- [ ] Legacy AuthKey-era free-text messages are almost certainly non-compliant
- [ ] Templates in AuthKey's console may not exist on DLT at all — audit them
- [ ] Category **Service Implicit** for OTP (Promotional is DND-blocked)
- [ ] Unicode off for English (halves segment size, doubles cost)
- [ ] `msisdn` 10-digit when `countrycode` is sent
- [ ] PE-TM chain must list Datagen as telemarketer
- [ ] Code 407 = source IP not whitelisted — whitelist your production egress IP
      if you enable that feature, or prod fails while local works
