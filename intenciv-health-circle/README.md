# IntenCiv Health Circle (Revision 2)

> Commercial mobile + web platform for **IntenCiv Diagnostics, Jaipur** — sells the IntenCiv Health Privilege Card (₹999 / 1 year) with 8 benefits, redeemed at IntenCiv labs.

Bundle ID `com.intenciv.healthcircle` · Version 1.0.0.

## Security model (key change in rev 2)

| Action                        | Authorised by                                                      |
|-------------------------------|--------------------------------------------------------------------|
| Admin login                   | Email + password                                                   |
| Salesperson login             | Mobile + admin-assigned 4-digit PIN                                |
| Card activation               | **Salesperson PIN (primary)** + customer OTP (only verifies mobile)|
| Customer app login            | Registered mobile only — no OTP, no password                       |
| Reception lookup / mark used  | Admin password (sent as `x-admin-password` header on every call)   |

OTP only ever proves a mobile number is reachable; it never authorises anything by itself. A random person with a card and a customer's OTP **cannot** activate a card — they also need the salesperson's PIN.

## Monorepo

```
/database/    001_create_tables.sql, 002_seed_tiers.sql (Standard plan + 8 benefits), 003_seed_admin.sql
/backend/     Node 20 + Express + Socket.io + mysql2 + bcryptjs
/web-panel/   React + Vite (admin panel — reception lives inside admin, password-gated)
/mobile/      Expo SDK 51 — role-select → customer-login (mobile only) or salesperson-login (mobile + PIN)
```

## Default admin credentials (CHANGE BEFORE GOING LIVE)

- Email: `intencivhealthcare@gmail.com`
- Password: `123456`

Regenerate a new hash with `node -e "console.log(require('bcryptjs').hashSync('NewPwd', 10))"` and patch `database/003_seed_admin.sql` (or update via SQL).

## Backend API surface (`/backend`)

```
POST   /auth/admin/login                   email, password
POST   /auth/salesperson/login             phone, pin
POST   /auth/customer/login                phone               (rejects if unregistered)
POST   /auth/refresh-token

GET    /salesperson/dashboard
GET    /salesperson/my-cards
POST   /salesperson/activation/send-otp     { card_id, customer_phone }
POST   /salesperson/activation/verify-otp   { card_id, customer_phone, otp }       → activation_token
POST   /salesperson/activation/finalize     { activation_token, pin, customer_name, customer_phone, card_id }

GET    /customer/me                         membership summary
GET    /customer/coupons                    grouped by benefit
GET    /customer/offers                     active home-screen offers

GET    /admin/dashboard                     KPIs + top salespersons
GET|POST|PUT|DELETE /admin/salespersons[/:id]
GET|POST|PUT       /admin/plans[/:id]      (with benefits array)
GET|POST          /admin/cards[/batch]      generate / list / filter, ?format=csv
PUT    /admin/cards/:id/assign              { salesperson_id }
GET|POST|PUT|DELETE /admin/offers[/:id]
GET    /admin/reports/sales                 ?from&to&salesperson_id&plan_id&format=csv
GET    /admin/reports/coupons               ?from&to&status&benefit_code&format=csv
POST   /admin/verify-password               re-prove password (for reception view)
POST   /admin/change-password
GET    /admin/reception/lookup/:code        + x-admin-password header
POST   /admin/reception/avail/:code         + x-admin-password header → realtime push to customer
```

## Data model (high level)

- `users(role: admin|salesperson|customer, phone, email, password_hash, pin_hash, …)`
- `plans + plan_benefits` (8 benefits per plan; `is_corporate`, `corporate_client_name`, `min_card_quantity`)
- `cards(card_number IHC-YYYY-NNNNN, status unused|assigned|active|expired, assigned_to_salesperson, customer_id, activated_at, expires_at)`
- `coupons(coupon_code IHC-CPN-NNNNN-XXNN, status unused|used|expired, …)`
- `offers` for the customer home-screen banners
- `otp_log` purposed for activation only

## Deployment quick start

1. **MySQL on Railway** → plugin → run the 3 SQL files.
2. **Backend on Railway** → set env from `backend/.env.example` (includes `AUTHKEY_API_KEY=2ba14bfe5d5d2db2`, `AUTHKEY_TEMPLATE_SID=39300`). Generate a strong `JWT_SECRET`.
3. **Web panel on Vercel** → root `web-panel`, set `VITE_API_URL` to the Railway URL.
4. **Mobile via EAS** → `eas build -p android --profile production` / `eas build -p ios --profile production`. `+91` is hard-coded in the customer login (India-only as required).

## Smoke test (after deploy)

1. Admin → `POST /auth/admin/login` (intencivhealthcare@gmail.com / 123456) → log in via web panel.
2. Admin → create a salesperson (`POST /admin/salespersons`) with phone + 4-digit PIN.
3. Admin → generate card batch (`POST /admin/cards/batch`) assigned to that salesperson.
4. Salesperson → opens mobile app → role-select → "Sales rep" → mobile+PIN.
5. Salesperson → Activate tab → pick card → customer details → OTP from authkey → PIN.
6. Customer → opens mobile app → role-select → "Member" → +91 + their number → sees membership + 8 benefits.
7. Admin (in web panel) → call `/admin/reception/lookup/:code` (with `x-admin-password`) → mark availed → customer's screen updates in real time via socket.io.

## Files removed in this revision

`/backend/routes/agent.js`, `/backend/routes/client.js`, `/backend/routes/reception.js`, `/backend/utils/codes.js`, `/backend/utils/otp.js`, web `Login.jsx` + `Reception.jsx` + `OtpLogin.jsx` (the receptionist-only OTP login is gone — reception is inside admin), web admin `Tiers.jsx` / `Codes.jsx` / `Users.jsx` / `Reports.jsx` (replaced by the Plans / Cards / Salespersons / Reports endpoints — wire your preferred React forms against them).

© IntenCiv Diagnostics, Jaipur.
