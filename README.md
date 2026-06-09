# SafeWay

SafeWay is a mobile navigation prototype for Almaty, Kazakhstan. The app builds a real route through OSRM, shows a free OSM-derived CARTO basemap, scores route safety from PostgreSQL risk zones, and supports optional accounts.

## What Is Included

- Expo SDK 54 React Native app in `mobile`
- Free CARTO raster basemap with visible OpenStreetMap/CARTO attribution
- Express API in `backend`
- PostgreSQL via `docker-compose.yml` or a local PostgreSQL instance
- Demo Almaty risk zones and safe places in `db/seeds`
- Optional registration/login with JWT
- Guest mode with local settings on the phone
- Account mode with profile and route preferences stored in PostgreSQL
- User risk reports, optionally attached to an authenticated user

## Project Structure

- `mobile/App.js` - app UI, map, profile, auth modals, settings screen
- `mobile/src/api.js` - API client and auth requests
- `mobile/.env` - mobile API URL for Expo
- `backend/src/routes/auth.js` - register, login, current user, preferences
- `backend/src/routes/routes.js` - safe route endpoint
- `backend/.env` - backend configuration
- `db/migrations` - PostgreSQL schema
- `db/seeds` - demo Almaty data
- `documentation/PROJECT_CODE_EXPLANATION_RU.md` - beginner-friendly Russian explanation of frontend, backend, database, technologies, and data flow

## Backend Environment

Create `backend/.env` from the example:

```powershell
cd C:\Users\toleu\Desktop\smart_maps\backend
copy .env.example .env
```

Settings:

```env
PORT=4000
DATABASE_URL=postgres://postgres:root@localhost:5432/safeway
OSRM_BASE_URL=https://router.project-osrm.org
JWT_SECRET=change-this-dev-secret
```

`DATABASE_URL` is where backend connects to PostgreSQL. If you change the database name, user, password, host or port in `docker-compose.yml`, update this line too.

## Start PostgreSQL

Start Docker Desktop first, then run:

```powershell
cd C:\Users\toleu\Desktop\smart_maps
docker compose up -d postgres
```

Apply the schema and demo data to the database configured in `backend/.env`:

```powershell
cd C:\Users\toleu\Desktop\smart_maps\backend
npm run db:setup
```

For a fresh Docker volume, migrations and seeds also run automatically.

If your database was already created before auth was added, apply the new migration manually:

```powershell
Get-Content db\migrations\002_auth_preferences.sql | docker exec -i safeway_postgres psql -U postgres -d safeway
```

To fully recreate the local demo DB:

```powershell
docker compose down -v
docker compose up -d postgres
```

This deletes local DB data.

## Start Backend

```powershell
cd C:\Users\toleu\Desktop\smart_maps\backend
npm install
npm run dev
```

Health check:

```powershell
Invoke-WebRequest http://localhost:4000/health
```

## Start Mobile App

For a connected Android phone over USB, `mobile/.env` can use localhost because `start-android.ps1` sets up `adb reverse`:

```env
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000
```

If you run through Wi-Fi QR instead of USB, change this value to your computer LAN IP.

Run on connected Android phone:

```powershell
cd C:\Users\toleu\Desktop\smart_maps\mobile
npm install
npm start
```

Then press `a` in the Expo terminal. To open Android immediately, use `npm run android`.

For Android Emulator use:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

### macOS Emulator Or Simulator

On Mac, keep the backend running first:

```bash
cd backend
npm install
npm run db:setup
npm run dev
```

Then start Expo from the mobile folder:

```bash
cd mobile
npm install
npm run start:mac
```

Open a simulator/emulator directly:

```bash
npm run ios:mac
npm run android:mac
```

For iOS Simulator, `http://localhost:4000` works, but the Mac script defaults to your LAN IP so it also works with physical phones on Wi-Fi. If needed, override it for one run:

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000 npm run ios:mac
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000 npm run android:mac
```

Android Emulator maps the host machine as `10.0.2.2`, so use that override if LAN access is blocked.

The macOS script sets `EXPO_PUBLIC_API_URL` before Expo starts, so a stale Windows IP in `mobile/.env` will not block the Mac run. Use the one-line override above when you want a specific URL.

## Auth And Guest Mode

Guest mode:

- No login required
- Route preferences are saved locally with `AsyncStorage`
- Reports can be sent without user binding

Account mode:

- Register or login from the Profile screen
- Current guest settings are sent to backend during login/register
- Preferences are stored in `user_preferences.settings` as JSONB
- Reports are saved with `user_reports.user_id`

## Main API Endpoints

Safe route:

```http
POST /api/routes/safe
```

```json
{
  "start": { "lat": 43.2495, "lng": 76.9459 },
  "end": { "lat": 43.2341, "lng": 76.9583 },
  "profile": "walk",
  "avoid": ["poor_lighting", "underpass"],
  "departureHour": 22
}
```

Auth:

```http
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
PUT /api/auth/preferences
```

Protected requests use:

```http
Authorization: Bearer YOUR_TOKEN
```

## Checks

Backend:

```powershell
cd backend
npm run check
```

Mobile:

```powershell
cd mobile
npx expo-doctor
npx expo export --platform android --output-dir dist-check
```

Delete `mobile/dist-check` after the export check if you run it manually.

## Production Notes

This is a prototype. For production, host your own routing service for Kazakhstan or use a paid routing provider, add moderation for reports, use verified risk data, rotate `JWT_SECRET`, enable HTTPS, and use a production tile provider plan or your own tile cache.
