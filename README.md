# Snooker Scoreboard

A free, offline snooker scoring app for **2 to 10 players**, for Android and iPhone.
No account, no adverts, no subscription. Built with React Native (Expo SDK 58) and TypeScript,
from a single codebase that also produces an installable web app.

- **Two players** use the official international rules (15 reds, 147 on the table).
- **Three to ten players** use rotation play with a choice of house rules for foul points.

## Features

**Scoring**
- Tap the ball that was potted. Only balls that are legally "on" can be scored; the app tracks
  red/colour alternation, the free colour after the last red, and the yellow-to-black clearance.
- Live scores, current break (with a trail of the balls potted), highest break, fouls per player,
  reds remaining, points remaining, ball on, lead, and "snookers required".
- Several reds in one shot ("+1 red, same shot").
- Fouls: choose what happened and the ball involved and the penalty (4 to 7) is worked out from
  the ball on and the highest ball involved. It can be overridden by hand.
- After a foul: next player, offender plays again, or "foul and a miss" (balls replaced, replay).
- Free ball, with a choice of the nominated ball. Breaks above 147 (up to 155) are supported.
- Reds potted on a foul stay down; colours are re-spotted.
- Final black: a pot or a foul ends the frame. Level scores give a **re-spotted black** with a coin toss.
- 147 maximum, century and 50+ breaks are recognised and celebrated.
- Undo (step by step, back to the break-off), manual score/reds correction, change the player at
  the table, restart frame, end frame (concession), end match.

**Matches**
- Single frame, best of 3, 5, 7, 9, or any number of frames up to 99. Optional 10-red and 6-red frames.
- Frames won, automatic match winner, break-off rotating each frame, summary after every frame.
- Multiplayer foul points: to the next player (default), to all other players, or chosen each time.

**Everything else**
- Saved after every action. Close the app or restart the phone and resume exactly where you were.
  Several unfinished matches can be kept at once.
- Match history, player profiles (rename, badge colour), career statistics and a leaderboard.
- Share a result as an image or as text.
- Sound effects, vibration, keep-screen-on, and three themes (baize green, dark, light).
- Built-in rules reference.

## Run it

Requirements: [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
```

```bash
npx expo start
```

- **On your phone (Android or iPhone):** install the free **Expo Go** app, then scan the QR code shown
  in the terminal. The phone and computer must be on the same Wi-Fi.
- **In a browser:** press `w` in the terminal, or run `npm run web`.

## Get it onto phones

### Android: build an APK

**Option A - cloud build (no Android tools needed).** Needs a free Expo account.

```bash
npx eas-cli@latest login
```

```bash
npm run build:apk
```

When the build finishes you get a link to download the `.apk`. Open it on the phone to install.

**Option B - build on this computer.** Needs Android Studio (for the Android SDK) and JDK 17.

```bash
npx expo prebuild --platform android
```

```bash
cd android && gradlew.bat assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.
Android builds can fail when the project folder path contains a space; if that happens, move the
project to a path such as `C:\dev\snooker` first.

### iPhone

Apple does not allow apps to be installed from a file the way Android does, so there are three routes:

1. **Installable web app (free, works today).** Build the web version and put the `dist` folder on any
   static web host (Netlify, Vercel, Cloudflare Pages, Firebase Hosting...). It must be served over
   HTTPS from the root of the site.

   ```bash
   npm run build:web
   ```

   On the iPhone open the address in Safari, tap **Share**, then **Add to Home Screen**. It then opens
   full screen like any app and works without an internet connection. The same works on Android
   (browser menu, **Install app**).

2. **Expo Go.** Good for trying the app, as described under "Run it".

3. **App Store / TestFlight.** Needs an Apple Developer Program membership (paid, yearly).

   ```bash
   npm run build:ios
   ```

Before publishing to a store, change `ios.bundleIdentifier` and `android.package` in `app.json`
to an identifier you own.

## Check it

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

`npm test` runs 194 automated tests of the rules engine and the save/resume layer.
See [TESTING.md](TESTING.md) for what is covered and the results.

## Project structure

```
src/
  engine/        Pure TypeScript rules engine - no UI code. Fully unit-tested.
    types.ts       Data types (events, frame state, match)
    balls.ts       Ball values and constants
    frame.ts       The frame state machine: sequence, fouls, free ball, re-spotted black
    selectors.ts   Points remaining, ball on, snookers required...
    match.ts       Frames, match score, winner, undo, restart
    stats.ts       Match totals and career statistics
    summary.ts     Text report for sharing
    __tests__/     Rules tests, including randomised full-frame fuzzing
  store/         App data: matches, players, settings, automatic saving
    logic.ts       Pure state transitions
    persistence.ts Loading/saving (one storage key per match)
    appStore.ts    The store (storage is injected, so it is testable)
  app/           Screens (Expo Router): home, new match, game, result, history,
                 players, statistics, settings, rules
  components/    game/ (balls, scoreboard, foul sheet...) and ui/ (buttons, sheets, dialogs...)
  services/      Sound + vibration, sharing
  theme/         Colours and themes
assets/          Generated icons and sound effects
scripts/         generate-icons.mjs, generate-sounds.mjs, generate-sw.mjs
public/          Web app manifest, icons and HTML template
```

**How scoring is stored.** A frame is saved as the list of things that happened (pots, fouls,
misses, corrections). The scoreboard is always recalculated from that list, so undo is exact and the
display can never drift out of step with what was recorded.

## Customising

- **Icon and splash:** edit colours/layout in `scripts/generate-icons.mjs`, then `npm run assets`.
- **Sounds:** edit the recipes in `scripts/generate-sounds.mjs`, then `npm run assets`.
- **Colours and themes:** `src/theme/index.ts`.

## Notes

- All data stays on the device (AsyncStorage on phones, browser storage on the web).
  Uninstalling the app, or clearing site data in a browser, deletes it.
- Finished matches keep their per-frame results and statistics; the shot-by-shot log is dropped
  when a match is finished, to keep storage small.
- Multiplayer snooker has no official rules, so foul-point sharing and tie-breaks (most frames,
  then most points) follow common house rules.
