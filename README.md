# Powerlifting Performance Hub

Mobile-first PWA for powerlifting athlete tracking, meet planning, attempt strategy and meet-day analytics.

## MVP v0.6

Current prototype includes:

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
- upcoming competition picker from the Powerlifting Calculator competition feed
- save Meet Day results into Progress history
- shareable square PNG result card
- passwordless email magic-code account
- cloud sync for athlete profile, meet plan, results, goals and history

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

Performance Hub v0.6 requires Powerlifting Trend Radar v1.12.0 on powerlifting-calculator.com for:
- upcoming competitions
- email magic-code authentication
- cloud profile GET/POST
- logout/session revocation

Email delivery uses WordPress `wp_mail()`, so production testing should confirm that transactional mail reaches real inboxes reliably.
