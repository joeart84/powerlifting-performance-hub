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

https://joeart84.github.io/powerlifting-performance-hub/

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
