# IntenCiv Health Circle

> A complete commercial mobile + web platform for **IntenCiv Diagnostics, Jaipur** — discounted health-test booklet sales, coupon management, and real-time lab redemption.

Bundle ID: `com.intenciv.healthcircle` · Version `1.0.0`
Website: <https://www.intenciv.in> · Phone: 0141-6695038 / 7399000299 · Email: contact@intenciv.in

---

## Monorepo layout

```
intenciv-health-circle/
├── mobile/        React Native + Expo SDK 51 app (clients + sales agents)
├── backend/       Node.js 20 + Express + Socket.io + mysql2
├── web-panel/     React + Vite (receptionist + admin)
├── database/      MySQL 8.0 migration scripts + seed data
├── .gitignore
└── README.md
```

Branches: `main` (production), `develop`, `feature/*`.

---

## 1. Prerequisites

| Tool        | Version |
|-------------|---------|
| Node.js     | 20.x    |
| npm / yarn  | latest  |
| Expo CLI    | `npm i -g expo`     |
| EAS CLI     | `npm i -g eas-cli`  |
| MySQL CLI   | 8.0     |

You will also need accounts on:

* **Railway.app** — backend + MySQL plugin
* **Vercel** — receptionist & admin web panel
* **Expo / EAS** — mobile builds
* **authkey.io** — OTP SMS gateway (the IntenCiv account & template are already approved)
* **Google Play Console** + **Apple Developer Program** — store submission

---

## 2. Local development setup

```bash
git clone <repo-url> intenciv-health-circle
cd intenciv-health-circle
```

### 2.1 Database

```bash
# Start a local MySQL 8 server, then:
mysql -u root -p < database/001_create_tables.sql
mysql -u root -p < database/002_seed_tiers.sql
mysql -u root -p < database/003_seed_admin.sql
```

> Open `database/003_seed_admin.sql` first and change `+919999999999` to **your** real admin mobile number. You will log into the admin panel via OTP using that number.

### 2.2 Backend

```bash
cd backend
cp .env.example .env
# Fill in DB_*, JWT_SECRET, AUTHKEY_* (provided below), FRONTEND_URL
npm install
npm run dev          # http://localhost:3000
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

authkey.io credentials are pre-configured in `.env.example`:

```
AUTHKEY_API_KEY=2ba14bfe5d5d2db2
AUTHKEY_TEMPLATE_SID=39300
```

The pre-approved template:

> Your IntenCiv OTP is {otp}. Valid for 10 minutes. Do not share. - IntenCiv Diagnostics

Health-check the backend: `curl http://localhost:3000/health`.

### 2.3 Web panel (receptionist + admin)

```bash
cd web-panel
cp .env.example .env
# Set VITE_API_URL and VITE_SOCKET_URL to your backend (e.g. http://localhost:3000)
npm install
npm run dev          # http://localhost:5173
```

Receptionists log in at `/login` (OTP). Admins log in at `/admin/login` (OTP).

### 2.4 Mobile (Expo)

```bash
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SOCKET_URL, EXPO_PUBLIC_WEBSITE_URL
npm install
npx expo start       # scan with Expo Go (Android) or iOS Simulator
```

Add the placeholder assets:

```
mobile/assets/icon.png       1024×1024
mobile/assets/splash.png     1284×2778 (light blue background)
```

(or use your own brand assets — paths are referenced in `app.json`).

---

## 3. Railway deployment — backend + MySQL

1. Create a new Railway project → **Add MySQL plugin**. Railway will inject `MYSQL*` env vars.
2. Add a second service → **Deploy from GitHub** → point at `/backend`. Railway uses `npm start`.
3. In the backend service, set env vars from `backend/.env.example`. Use the MySQL plugin's `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD` for `DB_*`.
4. Open Railway's MySQL **Query** tab and run the three SQL files from `/database` (in order).
5. The backend service exposes a public URL — note it. That's your `EXPO_PUBLIC_API_URL` and `VITE_API_URL`.
6. CORS: set `FRONTEND_URL` and `SOCKET_CORS_ORIGIN` to the Vercel domain (e.g. `https://app.intenciv.com`).
7. Custom domain (optional): map `api.intenciv.com` to the Railway service in your DNS.

---

## 4. Vercel deployment — web panel

1. Import the repo into Vercel → **Root Directory: `web-panel`**.
2. Framework preset: **Vite**.
3. Build command: `npm run build`. Output dir: `dist`.
4. Env vars: `VITE_API_URL`, `VITE_SOCKET_URL` (your Railway backend URL).
5. Deploy. Map a domain like `app.intenciv.com`.

The same domain serves both `/admin/*` and `/reception` — receptionists never see admin routes (role-guarded).

---

## 5. EAS Build — Play Store (.aab) and App Store (.ipa)

```bash
cd mobile
eas login
eas init                    # creates expo.extra.eas.projectId — paste it into app.json
```

### Android (Play Store)

```bash
eas build --platform android --profile production
```

Output: `*.aab`. Upload to **Google Play Console → Production**. Provide:

* App name: **IntenCiv Health Circle**
* Package: `com.intenciv.healthcircle`
* Privacy policy URL (host on `https://www.intenciv.in/privacy`).
* Data safety form — SMS OTP, contact info, no health data sold.

Automate later:

```bash
eas submit --platform android --profile production
```

Place your `google-service-account.json` in `mobile/` (already referenced in `eas.json`).

### iOS (App Store)

```bash
eas build --platform ios --profile production
```

Update `eas.json → submit.production.ios` with your real `appleId`, `ascAppId`, `appleTeamId`, then:

```bash
eas submit --platform ios --profile production
```

App Store Connect entries:

* Bundle ID: `com.intenciv.healthcircle`
* Category: Medical
* Encryption flag: No (only HTTPS + standard SecureStore — `ITSAppUsesNonExemptEncryption: false`).

---

## 6. authkey.io setup

You already have:

```
AUTHKEY_API_KEY      = 2ba14bfe5d5d2db2
AUTHKEY_TEMPLATE_SID = 39300
```

To find / rotate them, log in at <https://authkey.io>, go to **Account → API Authkey** and **Templates → SID**. The IntenCiv template above is already approved by the operator.

API endpoint used by the backend:

```
POST https://api.authkey.io/request
?authkey=<KEY>&mobile=<10digits>&country_code=91&sid=<SID>&otp=<4digit>
```

---

## 7. Creating the first admin user

`database/003_seed_admin.sql` inserts a row with role `admin`. **Edit the phone in that file before running** — that's the number that will log into `/admin/login` via OTP.

To promote an existing user to admin later:

```sql
UPDATE users SET role='admin', is_active=1 WHERE phone='+91XXXXXXXXXX';
```

Or create a sales-agent / receptionist directly from the admin panel → **Users → New user**.

---

## 8. End-to-end smoke test

1. Open `/admin/login` on the web panel → enter your admin phone → receive OTP → land on the dashboard.
2. Admin → **Tiers** → confirm Basic / Family / Senior seeded tiers.
3. Admin → **Users → New user** → create a sales agent (your phone, role = `sales_agent`).
4. Admin → **Activation Codes → Generate batch** → 5 codes for the Basic tier, assigned to that agent.
5. Open the mobile app on a different device → log in with the agent number → **Activate** wizard → enter a test client's phone → pick Basic → paste one activation code → confirm ₹799.
6. Open the mobile app on the **client's** phone → log in with the client number → see the coupons land.
7. From a receptionist account on the web panel → look up any coupon code → **Mark as Availed** → watch the client's mobile UI update in real time.

---

## 9. Security checklist (already enforced)

* Prepared statements only (`pool.execute(?, ?, …)`).
* OTPs stored as SHA-256 hash with 10-minute expiry and a hard 3-attempt cap.
* JWT payload contains only `{ id, role }`.
* Tokens are stored in **Expo SecureStore** on mobile (never AsyncStorage).
* Activation-code redemption uses `SELECT … FOR UPDATE` inside a DB transaction.
* Rate limiting: 3 OTP sends/hour/phone, 100 req/min/IP globally.
* CORS restricted to the Vercel domain; backend is HTTPS-only on Railway.
* Every protected route is role-guarded — mismatches return **403**.

---

## 10. Useful API curl examples

```bash
# 1. Send OTP
curl -X POST $API/auth/send-otp -H 'content-type: application/json' \
  -d '{"phone":"+919876543210"}'

# 2. Verify OTP
curl -X POST $API/auth/verify-otp -H 'content-type: application/json' \
  -d '{"phone":"+919876543210","otp":"1234"}'

# 3. Receptionist lookup
curl -H "Authorization: Bearer $JWT" $API/reception/lookup/CBC-K72X

# 4. Receptionist avail
curl -X POST -H "Authorization: Bearer $JWT" $API/reception/avail/CBC-K72X
```

---

© IntenCiv Diagnostics, Jaipur, Rajasthan, India.
