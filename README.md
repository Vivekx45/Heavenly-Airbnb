<div align="center">

# 🏡 Heavenly Stays

### Find a place to feel at home, wherever the map takes you.

An Airbnb-inspired accommodation app for discovering stays, creating listings, saving favorites, sharing reviews, and making demo bookings.

![Node.js 20.19+](https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white)
![Express 5](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?logo=mongodb&logoColor=white)
![Google sign-in](https://img.shields.io/badge/Sign--in-Google%20OIDC-4285F4?logo=google&logoColor=white)

</div>

## 🌟 What the project does

Heavenly Stays is a server-rendered web app built with Node.js, Express, EJS, and MongoDB. Signing in is required to use the app. User accounts, listings, reviews, bookings, saved stays, and login sessions are stored in the database connection active when the app starts.

### Guest features

- Browse listings, search by destination, and filter by category.
- Open a listing to see its photos, details, reviews, and location map; explore all listing locations on the world map.
- Save or remove favorite listings and view them from your account.
- Create listings with an uploaded photo, location, price, and details.
- Add reviews and delete your own reviews.
- Book dates, enter guest and contact details, choose a demo payment method, and view or cancel bookings.
- Sign in with a username/password account or Google OpenID Connect. Google sign-in is for guest accounts.

### Administrator features

The configured administrator has a dashboard with site totals and activity, user account details (including saved listings, visits, reviews, and bookings), and listing/review management. The administrator can edit or delete listings and edit or delete reviews. Admin access uses the Heavenly username and password login; it is not granted through Google sign-in.

## 🚀 Setup and start

### 1. Requirements

- Node.js **20.19 or newer** and npm
- Your own [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and database user
- A [Google OAuth](https://console.cloud.google.com/) web client for Google sign-in
- A [Cloudinary](https://cloudinary.com/) account for listing photo uploads
- A [Mapbox](https://www.mapbox.com/) access token for maps and geocoding

### 2. Install dependencies

Open a terminal in the project folder:

```bash
npm install
```

### 3. Create your Atlas connection

1. Create an Atlas cluster and a database user with read/write access. The database user is separate from your Atlas website login.
2. In Atlas **Network Access**, allow the IP address of the computer running the app.
3. Copy the cluster's Node.js connection string. URL-encode reserved characters in the database user's password.
4. Add your own credentials to a `.env` file in the project root.

```dotenv
MONGODB_URI=mongodb+srv://<database-user>:<url-encoded-password>@<cluster-host>/?retryWrites=true&w=majority
ATLAS_DB_NAME=heavenly_cloud

GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
APP_BASE_URL=http://localhost:8080

CLOUD_NAME=<cloudinary-cloud-name>
CLOUD_API_KEY=<cloudinary-api-key>
CLOUD_API_SECRET=<cloudinary-api-secret>
MAP_TOKEN=<mapbox-access-token>

SESSION_SECRET=<long-random-secret>
ADMIN_USER_ID=
PORT=8080
```

Replace every placeholder with your own value. Keep `.env` private; it is excluded from Git. `ATLAS_DB_NAME` is optional if the URI already includes the database name and otherwise defaults to `heavenly_cloud`. Leave `ADMIN_USER_ID` blank unless configuring the administrator.

Generate a session secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### 4. Configure Google sign-in

Create a Google OAuth client with application type **Web application**. Add this authorized redirect URI for local use:

```text
http://localhost:8080/auth/google/callback
```

For a deployed site, set `APP_BASE_URL` to its HTTPS origin and register the matching callback URL with Google.

### 5. Start the server

```bash
npm start
```

Open **[http://localhost:8080](http://localhost:8080)**. Create an account or sign in with Google. The terminal reports which MongoDB database was selected; confirm it names your Atlas cluster and intended database.

## 🧭 How to use the app

1. **Sign in:** choose user or administrator login. New registrations and Google accounts are guests by default.
2. **Find a stay:** use the search bar or categories on the listings page. Open a card for details and its individual map, or choose the world map to see all listings.
3. **Create a listing:** signed-in guests can use “Add your place.” Complete the listing details and upload a JPG, PNG, or WebP image (up to 8 MB). Cloudinary stores the uploaded image; Mapbox looks up the location coordinates.
4. **Save and review:** save a listing to find it later under Saved stays. Reviews are submitted from the listing page; users can remove their own reviews.
5. **Make a demo booking:** select a listing and dates, provide guest/contact/address details, choose a payment option, accept the terms, and confirm. Bookings are available from the account menu. A guest can cancel before check-in.
6. **Use administrator tools:** sign in through the administrator option to open the dashboard and its user, listing, and review pages. Regular users can create listings, but only the administrator can edit or delete listings.

### Booking rules

Check-in cannot be in the past. A booking must be between 1 and 30 nights, and dates already reserved for the listing cannot be booked again. Checkout offers card, UPI, and net banking as display choices only: the app does not collect payment credentials, process charges, or issue refunds.

## 🛡️ Configure the project administrator

New accounts are guests. The included one-time setup command is specifically configured for the existing local-password account `vivek` in the Atlas database `heavenly_cloud`:

```bash
npm run admin:atlas:keep-only-admin
```

Set `ADMIN_USER_ID` in `.env` to the account's MongoDB ObjectId before running it. **This command promotes that account and deletes every other user document in `heavenly_cloud`.** Listings and reviews are retained. Run it only if that account is yours and removing the other users is intended; back up Atlas first. See [ADMIN_ACCESS_SETUP.md](ADMIN_ACCESS_SETUP.md) for details.

## 🗄️ Database behavior and local fixtures

The app attempts Atlas first using `MONGODB_URI`. If Atlas cannot connect, it tries the local MongoDB development database `127.0.0.1/heavenly_main`. A startup message saying **local MongoDB** means the fallback is active. Check the URI, database-user credentials, Atlas IP access list, and network when you expect Atlas.

A new database has no listings. Create them through the app, or use the optional fixtures for local development only:

```bash
npm run seed:local
```

This command only connects to `127.0.0.1/heavenly_main`; it never writes to Atlas. It requires a running local MongoDB server, an existing local user to own the listings, and `MAP_TOKEN` for geocoding. By default it adds fixture listings that are missing and preserves existing ones.

To rebuild local fixtures in PowerShell (this removes local listings and their attached reviews first):

```powershell
$env:RESET_LISTINGS='true'
npm run seed:local
Remove-Item Env:RESET_LISTINGS
```

Login sessions are stored in the active MongoDB database and expire after up to seven days. The app does not copy data between Atlas and the local fallback.

## 🔧 Useful commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm start` | Start the app on port 8080 by default |
| `npm run seed:local` | Add missing local listing fixtures; never seeds Atlas |
| `npm run admin:atlas:keep-only-admin` | Owner-specific admin setup; deletes other users in `heavenly_cloud` |

There is no automated test suite configured yet; `npm test` is a placeholder script.

## 🔒 Before deployment

Set environment variables in the hosting platform, use a unique `SESSION_SECRET`, set `NODE_ENV=production`, and configure the production Google callback URL. Keep `.env` and all service credentials out of source control. For production, verify Atlas access rules and ensure the app connects to the intended database.

## 🧰 Built with

**Node.js · Express · EJS · MongoDB · Passport · Google OpenID Connect · Cloudinary · Mapbox**

Independent learning project; not affiliated with Airbnb. ISC license is declared in `package.json`.
