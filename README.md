# Powerlifting Performance Hub

Mobile-first PWA for powerlifting athlete tracking, meet planning, attempt strategy and meet-day analytics.

## MVP v0.2

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
- OpenPowerlifting CSV import processed entirely in-browser
- saved competition history
- automatic PR extraction from imported meets
- total progress chart
- DOTS progress chart

## Test on a phone

The app is designed to be deployed over HTTPS with GitHub Pages.

After GitHub Pages is enabled for this repository using **GitHub Actions**, the test URL will be:

https://joeart84.github.io/powerlifting-performance-hub/

### Android / Chrome

Open the test URL and use **Install app** or **Add to Home screen**.

### iPhone / Safari

Open the test URL, tap **Share**, then **Add to Home Screen**.

## MVP privacy

The first prototype intentionally has no account and no backend.

Athlete data, meet plan and meet-day results are stored only in the current browser/device using localStorage.

## Next steps

- direct OpenPowerlifting athlete lookup by name/profile
- percentile/context against similar lifters
- weight-class scenario tool
- goal planning
- shareable result graphics
- competition crawler integration
- account + cloud sync
- optional Capacitor wrapper for Android/iOS stores

## OpenPowerlifting import

Open an athlete page on OpenPowerlifting, download the competition results as CSV, then import that file in the **Progress** tab.

The CSV is parsed locally in the browser. It is not uploaded to this app or a third-party backend.

## Product direction

The intended loop is:

**Athlete → Progress → Goal → Meet → Attempts → Results → Analysis**
