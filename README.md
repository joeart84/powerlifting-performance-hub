# Powerlifting Performance Hub

Mobile-first PWA for powerlifting athlete tracking, meet planning, attempt strategy and meet-day analytics.

## MVP v0.1

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

## Planned Phase 2

- account + cloud sync
- OpenPowerlifting athlete lookup/import
- DOTS calculation and historical progress
- percentile/context against similar lifters
- saved meet history
- shareable result graphics
- competition crawler integration
- weight-class scenario tool
- goal planning
- optional Capacitor wrapper for Android/iOS stores

## Product direction

The intended loop is:

**Athlete → Progress → Goal → Meet → Attempts → Results → Analysis**
