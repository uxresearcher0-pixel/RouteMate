# RouteMate Mobile

Native iOS/Android app for RouteMate (Expo SDK 57 · expo-router · TypeScript).
Talks to the production API at `https://routemate.shahriarshanto.online/api`
with bearer-token auth stored in the device keychain (expo-secure-store).

EAS project: https://expo.dev/accounts/shahriaruxs-team/projects/routemate

## Screens

- **Login** — Employee ID or mobile number + password (same accounts as web,
  e.g. `E001` / `RouteMate@E001`)
- **Home** — my trip today with optimistic Going/Not-going toggles (respects
  the 10-min-before-start lock and HRM leave), open seats per route
- **Route** — morning/evening switch, true Hiace seat map (walkway left,
  driver right, P-numbered), tap-to-call driver & passengers, guest seat
  request with stop chips + times, passengers & stops lists
- **Profile** — my details, route, home stop with times, sign out

## Run it

```bash
cd mobile
npm install
npx expo start        # press i for iOS simulator (Xcode), or scan with Expo Go
```

Point at a local backend instead of production:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
```

## Build & distribute (EAS)

```bash
npx eas-cli build --platform ios --profile preview     # internal/simulator build
npx eas-cli build --platform android --profile preview # .apk for testers
npx eas-cli build --platform all --profile production  # store builds
```

The first iOS build will prompt for Apple credentials (EAS manages
certificates/profiles). `eas.json` is created on the first `eas build` run.

## Structure

```text
src/app/            expo-router screens (index gate, login, (tabs), route/[code])
src/components/     seat-map, attendance-toggle
src/lib/            api client + token storage, seat helpers, theme (slate palette)
```

The design mirrors the web app's minimalist system: slate-900 as the only
accent; emerald/rose/amber reserved for going/not-going/warnings.
