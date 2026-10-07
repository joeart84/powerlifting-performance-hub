# Powerlifting Performance Hub

Mobile-first PWA for powerlifting athlete tracking, meet planning, attempt strategy and meet-day analytics.

## MVP v0.10

Current prototype includes:

### v0.10 scoring + navigation fix
- fixed secondary Report / Account / Settings navigation on desktop and mobile
- WUAP Reshel score shown beside DOTS
- WUAP McCulloch Masters score using the official age multiplier table (40–80)
- athlete age field with OpenPowerlifting Age import fallback
- McCulloch stays blank below age 40 because it is a Masters adjustment
- Reshel currently uses a smooth approximation of the published WUAP coefficient table; the UI should be treated as beta until exact table lookup is embedded


### v0.9 UI/UX refresh
- simplified 5-destination primary navigation
- mobile bottom navigation optimized for thumb reach
- secondary Report / Account / Settings navigation
- redesigned athlete dashboard hierarchy
- refined dark performance-oriented design system
- cleaner competition discovery cards and filters
- more compact meet-planning surfaces
- new minimalist Performance Hub app mark


- athlete onboarding
- current S/B/D and total dashboard
- next-meet countdown
- automatic starter attempt suggestions
- editable 9-attempt Meet Planner
- Meet Day Mode with Good / Miss tracking
- live best-total calculation
- post-meet success report
- native share support where available
- localStorage persistence
- installable PWA shell
- offline caching
- current DOTS calculation
- one-tap OpenPowerlifting athlete import from name/slug/profile URL
- OpenPowerlifting CSV import retained as an advanced fallback
- saved competition history
- automatic PR extraction from imported meets
- total progress chart
- DOTS progress chart
- multi-result athlete search for ambiguous OpenPowerlifting names
- strength context using OpenPowerlifting percentile references
- weight-class/bodyweight DOTS simulator
- target-DOTS goal planner
- saved goal + target date with progress-to-goal on dashboard
- location-aware Competition Finder from the Powerlifting Calculator competition feed
- search by competition, city, country, venue or federation
- Near me / My country / Europe / Worldwide scopes
- 100 / 250 / 500 km radius filtering when coordinates are available
- 30-day / 3-month / 6-month date filters and federation filter
- manual home city/country or optional browser geolocation
- save Meet Day results into Progress history
- shareable square PNG result card
- passwordless email magic-code account
- cloud sync for athlete profile, meet plan, results, goals and history
- internationalization with external JSON locale files
- Settings language selector with system-language auto detection
- English, Slovak, Czech, German, Spanish and Polish UI

## Test on a phone

The app is designed to be deployed over HTTPS with GitHub Pages.

After GitHub Pages is enabled for this repository using **GitHub Actions**, the test URL will be:

https://app.powerlifting-calculator.com/

### Android / Chrome

Open the test URL and use **Install app** or **Add to Home screen**.

### iPhone / Safari

Open the test URL, tap **Share**, then **Add to Home Screen**.

## Data and cloud sync

The app remains local-first. Athlete data is stored in the current browser using localStorage.

Cloud sync is optional and explicit. When a user signs in with an email magic code, they can upload the current device state to powerlifting-calculator.com or load the cloud copy onto another device. Passwords are not used by the Hub. Login sessions expire after 30 days.

## Next steps

- federation / age-specific strength reference filters
- richer competition discovery and filtering
- saved multiple goals
- optional Capacitor wrapper for Android/iOS stores
- production onboarding, analytics and account recovery polish

## OpenPowerlifting import

The primary mobile flow accepts a lifter name, OpenPowerlifting username/slug, or full profile URL. Performance Hub requests the athlete's public OpenPowerlifting competition CSV through a small read-only proxy on powerlifting-calculator.com, then stores the resulting history locally in the browser.

For ambiguous names, paste the exact OpenPowerlifting profile URL.

CSV file import remains available under **Advanced fallback**.

## Product direction

The intended loop is:

**Athlete → Progress → Goal → Meet → Attempts → Results → Analysis**


## Performance reference

The Strength Context tool uses a server-generated reference dataset built from recent OpenPowerlifting Raw full-power SBD performances. The reference stores P10, P25, P50, P75, P90, P95 and P99 DOTS thresholds by sex and weight class.

Displayed percentiles are estimates interpolated between these reference thresholds and should be treated as descriptive context rather than a prediction or ranking of an athlete's future performance.


## Cloud backend requirement

Performance Hub v0.8 requires Powerlifting Trend Radar v1.13.0 on powerlifting-calculator.com for:
- upcoming competitions
- email magic-code authentication
- cloud profile GET/POST
- logout/session revocation

Email delivery uses WordPress `wp_mail()`, so production testing should confirm that transactional mail reaches real inboxes reliably.


## Internationalization

UI strings live in `locales/*.json` and are referenced by stable translation keys. The selected language is stored locally.

Supported languages:
- English (`en`)
- Slovak (`sk`)
- Czech (`cs`)
- German (`de`)
- Spanish (`es`)
- Polish (`pl`)

The **System language** option follows the browser/device locale when it matches a supported language and falls back to English otherwise. Locale files are included in the PWA offline cache.


## Competition Discovery

Competition records can include city, region, venue and crawler-generated latitude/longitude. Nearby sorting uses the Haversine distance between the user's optional home/current coordinates and competition coordinates.

Location is optional:
- users can enter a home city and country, resolved through the Hub backend;
- users can explicitly grant browser geolocation;
- without coordinates, the app can still filter by home country and use neighboring-country fallback for nearby discovery;
- Worldwide search is always available.
# Account and preview setup

The app is a static PWA served from GitHub Pages. It has no build step. The existing email-code account uses the Powerlifting Trend Radar WordPress REST API at `powerlifting-calculator.com`; its sessions and cloud profiles are not Firebase accounts. Local athlete data remains in browser storage.

The optional Firebase Auth path is implemented in `firebase-auth.js`. With the default `firebase-config.js` set to `null`, the new controls are hidden and existing email-code accounts continue to work. To activate Firebase:

1. Create a Firebase web app and a Cloud Firestore database. Set the public web fields `apiKey`, `authDomain`, `projectId`, `appId` in `firebase-config.js`. Firebase web config is an identifier, not a secret. Keep service account keys and OAuth client secrets out of this repository.
2. Enable Google and Email/Password in Authentication. Add `joeart84.github.io` to Authorized domains. Set `enabledProviders: ["google", "password"]` in the config.
3. Publish Firestore rules that allow a user to read and write only their own Hub document:

   ```text
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /hubProfiles/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

4. Optionally enable Facebook and X/Twitter in Firebase Authentication, configure their OAuth application IDs, secrets and callback URLs in those providers' dashboards, then include `"facebook"` and/or `"twitter"` in `enabledProviders`. These credentials belong in the Firebase/provider consoles, never in this repo.
5. A WordPress cloud account does not automatically become a Firebase account. To move data, sign in with the old email code, load cloud data onto this device, sign out, create/sign in to the Firebase account, then upload this device. Do not upload an empty local profile over valuable cloud data.

`fix/birth-date-entry` deploys a test copy to `/preview/birth-date-entry/` on GitHub Pages while copying `main` into the production root. A later `main` deployment replaces the Pages artifact and removes the preview path. Merge the PR to publish the approved changes to the normal root URL; the production workflow deploys `main`.

If the WordPress email-code form reports a network error, check that the WordPress REST endpoint responds to cross-origin `OPTIONS` and `POST` from the GitHub Pages origin with the right `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` (especially `Content-Type` and `Authorization`). The frontend cannot override a server CORS policy or site firewall.

Brand colors: background `#101417`, off-white `#edf2f0`, warm gold `#d9ad54`. `logo.svg` is the horizontal lockup, `mark.svg` is the small header mark, and `icon.svg` plus the PNG sizes serve favicon and PWA icons.


## Website integration and reliability (October 2026)

The Hub shares Powerlifting Calculator’s red accent, charcoal header and website links. A homepage entry on the main WordPress website opens the app. All six locales include the new labels. Installed-app icons and result cards use the same brand colors.

Run `npm test` for storage-recovery and service-worker regression checks; CI runs these alongside syntax checks and the mobile build. Invalid profile number inputs are checked before saving. Reshel and its McCulloch-adjusted score remain approximations and are labeled as estimates.

Malformed local profile/session JSON no longer aborts startup. Its first original value is retained under the corresponding `-recovery` localStorage key before defaults are saved. This is a recovery aid, not a substitute for an export backup. The service worker caches only its own known assets, preserves cached assets during HTTP errors, never substitutes HTML for scripts/JSON and only clears older Hub caches.

Review follow-ups: user-facing JSON backup/restore; verified reference-table scoring shared with the website; browser regression coverage for profile edits, CSV import and cloud merge conflicts; separate preview hosting and a deployment gate after successful CI. Live review covered a local demo profile, score display, planner, competition feed and navigation. Cloud authentication and installation on physical phones require separate end-to-end testing.


## Backup, scoring parity and cloud review (v13)

Backup controls are available during onboarding and in Settings. Export includes profile, goal, meet plan/results, history, preferences and language; it excludes accounts and authentication data. A file is validated before preview and again before replacement. The size limit is 5 MiB. Restoring a file or loading cloud data retains one credential-free undo copy under `plc-performance-hub-v6-before-restore`, accessible through Undo last restore. Restore only changes this device; cloud upload remains explicit.

`scoring.js` mirrors the live main-site calculator checked on 6 October 2026. Source URLs and SHA-256 digests are in `scoring-reference/provenance.json`. Reshel uses the site's bundled tables and exact quarter-kilogram fallback rules. DOTS uses the same bodyweight boundaries. The fourth dashboard number now means age-adjusted **total in kg**, as on the website, rather than the old Reshel × WUAP age score. Ages 14–90 and junior/Open/Masters multipliers match the website. Legacy table provenance remains unverified; both interfaces explain this limitation. These values are available offline. `tests/fixtures/website-scoring.cjs` captures the relevant source functions for parity checks.

Cloud writes no longer happen automatically at sign-in. Upload and download first compare device/cloud summaries and require an explicit choice. A second cloud read before committing rejects a changed device, account or remote version. Parallel operations are blocked; invalid data and failed reads do not replace device data. Cloud operations use the same validator as backups. This is a client-side conflict guard, not atomic server-side compare-and-swap: simultaneous writes between the last read and the server write remain possible until the backend supports revision preconditions.

Google initialization is protected against concurrent renders and only initializes the SDK once. Expired WordPress sessions return to sign-in after a 401 response. Regression tests simulate cloud conflicts, malformed responses, offline failures and concurrent auth startup without real credentials. Completing an actual email/Google sign-in and cross-device cloud round-trip still requires an authenticated test account. Firebase is disabled by the current config; the active path is the WordPress backend.

## UX and Android preparation (v14)

Dashboard offers one next action based on meet date, complete attempt weights and recorded results. Meet Day has a focused one-attempt view, next attempt, 2.5 kg adjustments, large Good/Miss controls and last-change undo (kept across relaunch; invalidated when the planner changes or device data is replaced). Settings puts backup first and separates reset in a collapsed device-data section. Decimal fields accept dot/comma with explicit bounds. Score explanations open an accessible dialog, and help/report names follow the selected language.

Save status distinguishes device storage from the last explicitly synchronized cloud copy. It does not claim knowledge of subsequent remote changes. Sync metadata excludes bearer credentials. Android uses native file/share integration and native HTTP transport, hardware Back handling, consent-safe serialized test banners and email-code login. Unsupported web Google login is hidden in Android. Native Google configuration is a separate release blocker if Google login is required for the Android launch.

`npm test` includes DOM integration and native-ad consent tests. The Android workflow builds APK/AAB, runs lint, checks ELF alignment and executes an installed-app smoke test. See [Google Play release preparation](docs/google-play-release.md) for signing, real-account/physical-device tests and current Play requirements. Public privacy/deletion-request pages are bundled with the app; deletion requests require owner processing.

`npm run build:web` stages only public assets. Pages deployment now waits for frontend tests/mobile-bundle validation instead of publishing an unchecked commit.

## Reshel import fix (0.14.1)

Missing interior coefficients caused valid OpenPowerlifting weights to display no Reshel score. Added 57 male and 37 female entries from GPC references, retaining imported bodyweight and the existing quarter-kilogram lookup. Original coefficients, DOTS and age factors remain unchanged. Sources, unresolved source typos and scope are recorded in `scoring-reference/provenance.json`; restored entries are in `reshel-restored.json`. The website parity fixture now retains independent original table snapshots.

Validation: 26 frontend tests pass, including an OpenPowerlifting import at 109.37 kg / 600 kg total (532.20 Reshel), followed by adding age without changing weight. Mobile and public web bundles build. Android instrumentation verifies the previously missing weight interval using decimal-comma input and persistence. Android versionCode 15 / versionName 0.14.1 embeds the updated table; an installed 0.14.0 APK needs an update. Debug builds may have different signing keys between CI runs; export a backup before any uninstall/reinstall.


## Competition finder and athlete preferences (0.15.0)

+ Android uses explicit native JSON requests for competitions, manual geocoding and performance references, with a bounded wait for the native bridge. Missing or malformed feeds are shown as errors; successful feeds are cached for offline filtering. Without a saved location the finder defaults to Worldwide. Manual city/country inputs are available directly in the finder as well as Settings. Approximate foreground location is requested only after tapping Use my location; no background location is used.
+ Preferred DOTS/Reshel is stored in preferences and applied to history/chart, simulator, goals, manual previews, report and sharing. The dashboard shows the chosen score. Reference percentiles retain their DOTS dataset and are labelled accordingly.
+ Weight units are Auto/kg/lbs. Auto follows a US device locale, not GPS. Display and user entry convert at the UI boundary; all stored values, backups, OPL imports and calculations remain in kg. Unchanged converted inputs retain their exact original kg values; planner step buttons still move by 2.5 kg, shown in the selected unit.
+ Horizontal swipes move between the five main tabs. Inputs, tables, charts, screen edges and competition focus mode keep their normal gestures.
+ Each lift can enable a fourth record attempt. Its weight/result persist in plan, backup/cloud and saved history. Total, scored lift bests, DOTS/Reshel, PR updates and nine-attempt success rates use only the first three attempts per lift. Reports list record attempts separately; eligibility follows the federation and referees. Legacy three-attempt backups still load.

Validation: 33 frontend tests cover conversions without drift, unit entry, score selection, filtering, geocoding, denied location, cached data, swipe exclusions, fourth attempts and backup preservation. Android instrumentation checks bundled scoring, conversions, record exclusion/persistence, declared location permission, live native competition loading and city geocoding. Physical-device location permission and GPS behavior still need user confirmation. Android versionCode 16 / versionName 0.15.0.
