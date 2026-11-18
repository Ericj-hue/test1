# Lift Habits

A one-screen powerlifting habit tracker for iPhone and Android (Expo SDK 58).

- A list of daily habits (training, warm-up, logging, protein, water, sleep, steps).
- Tap a habit to tick it; a counter shows how many are done today.
- Ticks start fresh every day. Everything is saved on the device.
- Tap **Edit** to add or remove habits.

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `w` to open it in a browser.

## Check it

```bash
npm run typecheck
npm run lint
```

Main code: `src/app/index.tsx` (the screen) and `src/lib/habits.ts` (habits and saving).
