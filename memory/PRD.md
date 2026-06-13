# IntenCiv Health Circle — Product Requirements (PRD)

**Status:** v1.0.0 — Code-only delivery (Node.js/Express/MySQL stack, user deploys to Railway + Vercel + EAS)
**Repo root:** `/app/intenciv-health-circle/`

## 1. What this is

A complete commercial mobile + web platform for **IntenCiv Diagnostics, Jaipur** that sells discounted health-test booklets to clients through a field sales team, with real-time coupon redemption at IntenCiv labs.

Four roles:
- **Admin** — full system access (web)
- **Sales Agent** — activates booklets, registers clients (mobile)
- **Client** — views coupons, books home collection via website link (mobile)
- **Receptionist** — searches coupon codes, marks them availed (web)

## 2. Tech stack (per user choice 1b)

| Layer       | Choice                                              |
|-------------|-----------------------------------------------------|
| Mobile      | React Native + Expo SDK 51, Expo Router             |
| Backend     | Node.js 20 + Express + Socket.io                    |
| Database    | MySQL 8.0 (mysql2 prepared statements only)         |
| Web panel   | React + Vite                                        |
| OTP SMS     | authkey.io (key `2ba14bfe5d5d2db2`, SID `39300`)    |
| Auth        | JWT — access 7d, refresh 30d, stored in SecureStore |
| Real-time   | Socket.io — `client:<userId>` rooms                  |
| Deploy      | Railway (API + MySQL), Vercel (web), EAS (mobile)   |

> Preview note: per user choice, this codebase is **not** wired into the Emergent preview. The Emergent default FastAPI/MongoDB/Expo services remain untouched. All files live under `/app/intenciv-health-circle/`.

## 3. Folder structure

```
intenciv-health-circle/
├── database/        # 001_create_tables.sql, 002_seed_tiers.sql, 003_seed_admin.sql
├── backend/         # Express + Socket.io + mysql2
├── web-panel/       # React + Vite (receptionist + admin)
├── mobile/          # Expo SDK 51 (client + sales agent)
├── README.md        # Full setup + Railway + Vercel + EAS guide
└── .gitignore
```

## 4. API surface (`/backend`)

All routes prefixed with the Railway domain; JWT Bearer required except `/auth/*`.

- `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/refresh-token`
- `GET /client/profile`, `PUT /client/profile`, `GET /client/coupons`, `GET /client/booklets`
- `POST /agent/activate-booklet`, `GET /agent/my-sales`, `GET /agent/verify-client/:phone`
- `GET /reception/lookup/:code`, `POST /reception/avail/:code`
- `GET /admin/dashboard`, `GET|POST /admin/tiers`, `PUT /admin/tiers/:id`, `GET|POST /admin/activation-codes`, `GET|POST /admin/users`, `PUT /admin/users/:id/toggle`, `GET /admin/reports/sales`, `GET /admin/reports/coupons` (both with `?format=csv`)
- `GET /health` — liveness + DB ping

## 5. Security (implemented)

- Prepared statements via `pool.execute()` everywhere — no string concatenation.
- OTP stored as **SHA-256 hash** with 10-minute expiry, 3-attempt cap.
- JWT payload contains only `{ id, role }`. Tokens in Expo SecureStore (mobile).
- Activation-code redemption wraps `SELECT … FOR UPDATE` in a DB transaction — no double redemption.
- Rate limits: 3 OTP sends per phone per hour, 100 req/min/IP globally.
- Helmet + CORS restricted to the configured `FRONTEND_URL` / `SOCKET_CORS_ORIGIN`.
- Role-guard middleware on every protected route → 403 on mismatch.

## 6. Real-time flow

1. Mobile client signs in → joins room `client:<userId>` via Socket.io.
2. Receptionist `POST /reception/avail/:code` → server emits `coupon:availed` to that room.
3. Client app updates the coupon card (green → gray with checkmark) and shows a toast.

## 7. Mobile UX highlights

- Phone Entry → OTP Verify (4-box, auto-advance, 60s resend countdown, shake-on-error).
- Profile Setup forced on first-time clients (name, address, city, pincode mandatory).
- Client tabs: Home (KPIs + booklet card + recent coupons + Book Home Collection CTA), Coupons (filter chips), Profile (contact details, sign-out).
- Agent tabs: Home (today/month KPIs + recent activations), Activate (3-step wizard with success animation), My Sales (progress bar per booklet).
- All client screens expose **Book Home Collection** → `Linking.openURL('https://www.intenciv.in')`.
- Bundle ID: `com.intenciv.healthcircle` · Android permissions: INTERNET, RECEIVE_SMS, READ_SMS, VIBRATE.

## 8. Web panel UX

- `/login` — Receptionist OTP login (rejects non-receptionists).
- `/reception` — Hero search → coupon details card → "Mark as Availed" (confirmation dialog).
- `/admin/login` → admin panel with sidebar nav: Dashboard / Tiers / Codes / Reports / Users.
- Codes & Reports support **CSV export** (server streams `text/csv`).

## 9. authkey.io integration

`POST https://api.authkey.io/request?authkey=…&mobile=…&country_code=91&sid=39300&otp=…&name=…`

Server-side OTP generation (`crypto.randomInt`), 4-digit numeric, hashed before storage. Welcome SMS reuses the same SID with `name=<tier>` and `otp=<coupon count>` (the operator can configure a dedicated welcome template SID via `AUTHKEY_WELCOME_SID`).

## 10. Seeds shipped

Three booklet tiers seeded by `002_seed_tiers.sql`:
- **Basic** ₹799 — 5 tests
- **Family** ₹1499 — 10 tests
- **Senior** ₹1299 — 10 tests (heart/diabetes/kidney/bone focus)

Admin seed in `003_seed_admin.sql` — operator must change `+919999999999` to their real number before running.

## 11. Deploy pipeline (in README)

1. Railway → MySQL plugin → `database/*.sql` migrations → backend service.
2. Vercel → `web-panel` (Vite preset).
3. EAS Build → Android `.aab` (`eas build -p android --profile production`) → Google Play.
4. EAS Build → iOS `.ipa` → App Store Connect.
5. `eas submit` for both stores once credentials are populated in `eas.json`.

## 12. Open follow-ups for the operator

- Replace `mobile/assets/icon.png` and `splash.png` with branded artwork (1024² and 1284×2778).
- Fill `eas.json` submit credentials (`appleId`, `ascAppId`, `appleTeamId`, `google-service-account.json`).
- Configure custom domains: `api.intenciv.com` → Railway, `app.intenciv.com` → Vercel.
- Optional: add a dedicated authkey.io welcome-SMS template SID and set `AUTHKEY_WELCOME_SID`.
- Optional: store `tier_id` filter on activation by tier price band; add export to admin sales report by month.
