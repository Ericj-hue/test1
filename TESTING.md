# Testing report

Date: 17 November 2026 · Expo SDK 58 · React Native 0.88

## Summary

| Check | Result |
| --- | --- |
| Automated tests (`npm test`) | **194 passed, 0 failed** (9 test files) |
| Type check (`npm run typecheck`) | Clean |
| Lint (`npm run lint`) | Clean |
| Expo project health (`npx expo-doctor`) | 20 of 20 checks passed |
| Production bundle - Android | Compiles (Hermes bytecode) |
| Production bundle - iOS | Compiles (Hermes bytecode) |
| Production bundle - Web | Compiles; installable; verified working offline |
| Run through in a browser at phone size (390 x 844) | Passed (details below) |
| Android release APK (`gradlew assembleRelease`) | Built: 1.0.0, arm64-v8a + armeabi-v7a, debug-signed |

**Not tested:** the app has not been run on a physical phone or an emulator, and no iOS binary
was built (needs a Mac or EAS). See "What has not been verified".

## Required scenarios

| # | Scenario | Where it is tested | Result |
| --- | --- | --- | --- |
| 1 | A complete standard 15-red frame | `frame.sequence.test.ts` - "a complete two-player frame" checks final scores (61 v 66), every break, reds/colours potted, fouls and visits | Pass |
| 2 | Red-colour alternating sequence | `frame.sequence.test.ts` - red required first, any colour after a red, two colours in a row rejected, red after red rejected, several reds in one shot | Pass |
| 3 | Final colour clearance | `frame.sequence.test.ts` - free colour after the last red, yellow-to-black order enforced at every step, frame ends on the black | Pass |
| 4 | Foul penalties (4 to 7) | `frame.fouls.test.ts` - every ball on and ball involved combination, nominated colour, no nomination (7), minimum by ball on, out-of-range values rejected | Pass |
| 5 | Free-ball scoring | `frame.freeball.test.ts` - with reds on (scores 1, colour follows), in the clearance (scores the ball on, which stays), nomination rules, lost on a miss, kept after a replaced miss | Pass |
| 6 | Maximum 147 break | `frame.sequence.test.ts` - 147 recognised; 146 and 10-red clearances are not; a 155 with a free ball is scored but not called a 147 | Pass |
| 7 | Re-spotted colours | `frame.sequence.test.ts`, `frame.fouls.test.ts` - colours return while reds remain, stay down in the clearance, and are re-spotted after a foul | Pass |
| 8 | Re-spotted black tie-break | `frame.respot.test.ts` - called on level scores, either player may go first, first pot wins, first foul loses (7), also after a levelling foul on the final black | Pass |
| 9 | Undo and manual correction | `match.test.ts` - undo restores the exact previous position after every step of a 30-action frame; `frame.corrections.test.ts` - score and reds corrections, including overturning a finished frame | Pass |
| 10 | Multiplayer with 3, 4, 5 and 10 players | `multiplayer.test.ts` - rotation order, staying at the table while scoring, all three foul options, individual statistics, tie-breaks between level leaders | Pass |
| 11 | Saving and resuming | `store.test.ts` - saved after every action; an unfinished match (mid-break, free ball pending) is identical after a simulated restart; several unfinished matches; damaged data is skipped, never crashes | Pass |
| 12 | Match completion and winner | `match.test.ts` - best of 1/3/5/7/9/11/35, deciding frames, early finish, multiplayer ties broken on points, draws | Pass |

## Randomised testing

`frame.fuzz.test.ts` plays several hundred complete frames of random but legal actions (2, 3, 4, 5
and 10 players; every foul option; with and without free balls; 6, 10 and 15 reds). After **every
single action** it checks that:

- each score equals points potted + penalty points received + corrections
- each player's breaks add up to the points they potted
- reds potted + reds on the table + reds lost to fouls equals the number the frame started with
- every penalty point given away was received by someone
- points remaining never rise (without free balls) and never exceed 147
- a finished frame has exactly one winner, who has the outright highest score
- rebuilding the frame from its saved actions gives an identical scoreboard

## Do the tests catch mistakes?

Two rule bugs were introduced on purpose and the suite re-run:

| Deliberate bug | Outcome |
| --- | --- |
| Free ball in the clearance also removes the ball on | 2 tests failed |
| Foul value ignores the ball on | 4 tests failed |

The engine was restored afterwards and all 194 tests pass.

## Run through in a browser (phone size)

Performed against the running app:

- Start a match with default names; pot red, black, red, blue: score 14, break trail correct,
  reds 13, 131 remaining.
- Tap a colour while a red is on: refused, with an offer to record a foul.
- Foul sheet: red on + blue hit first gives 5; awarded to the opponent, turn passes, break resets.
- Reload the page mid-frame and open the match address directly: match restored exactly.
- Play to the final black (break of 116 shown), pot it: frame summary, then match result page.
- Result page figures match the play (137 v 13, break 123, pots, fouls, penalty points).
- Share as image produces a PNG; copy as text produces the report.
- 10-player match: all ten cards and the ball pad fit on one screen with nothing cut off;
  rotation and "foul to next player" work.
- Correct a score from the menu; undo from the frame summary.
- Foul on the final black that levels the scores: re-spotted black prompt, coin toss, chosen player
  goes first, only the black is live, pot wins the frame.
- End a match early, delete a match, delete players - each asks for confirmation first.
- History, players, statistics, settings and rules screens show the right data with no layout overflow.
- Light theme renders correctly.
- Web build: service worker installs and caches all 46 files; with the server switched off the app
  still opens, including directly on an inner page.

Two problems were found and fixed during this run through:

1. Ball graphics on the web shared gradient ids between screens, which could leave them unpainted.
   Each ball now has a unique id.
2. `expo-doctor` reported a missing `expo-asset` dependency that would have broken sound playback
   in a standalone build. It is now installed.

## What has not been verified

- **Real devices.** Not run on an Android phone, an iPhone, or an emulator. The Android and iOS
  JavaScript bundles compile, and every library used is a standard Expo module, but native-only
  behaviour is untested: vibration, sound through the phone speaker, the system share sheet,
  keep-screen-on, safe-area spacing around notches, and the Android back button.
- **APK install.** An APK was built locally and its contents checked (package name, version,
  permissions, bundled JavaScript and sounds), but it has not been installed on a phone. It is
  signed with the Android debug key, so it can be sideloaded but not published to the Play Store.
- **iOS build.** Not produced. `eas.json` and `app.json` are set up for it; the steps are in the README.
- **Screen readers.** Buttons and scores carry accessibility labels, but the app has not been
  tested with TalkBack or VoiceOver.
