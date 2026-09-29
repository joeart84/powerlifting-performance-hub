# Powerlifting Performance Hub

Mobile-first PWA for powerlifting athlete tracking, meet planning, attempt strategy and meet-day analytics.

## MVP v0.3

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

- true multi-result athlete search for ambiguous names
- percentile/context against similar lifters
- weight-class scenario tool
- goal planning
- shareable result graphics
- competition crawler integration
- account + cloud sync
- optional Capacitor wrapper for Android/iOS stores

## OpenPowerlifting import

The primary mobile flow accepts a lifter name, OpenPowerlifting username/slug, or full profile URL. Performance Hub requests the athlete's public OpenPowerlifting competition CSV through a small read-only proxy on powerlifting-calculator.com, then stores the resulting history locally in the browser.

For ambiguous names, paste the exact OpenPowerlifting profile URL.

CSV file import remains available under **Advanced fallback**.

## Product direction

The intended loop is:

**Athlete → Progress → Goal → Meet → Attempts → Results → Analysis**
