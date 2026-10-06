# Android / Google Play release preparation — 0.14.0

Package: `com.powerliftingcalculator.performancehub`. Version code: 14; version name: 0.14.0. Before upload, compare the version code with the highest code already used in your Play Console; increase `android-release.json` if needed. Minimum Android API 24, target/compile API 36. Test ads only.

## Build and test

Requirements: Node 22+, Java 21, Android SDK with API 36, accepted SDK licences.

```
npm ci
npm test
npm run android:init
cd android
./gradlew assembleDebug bundleRelease lintDebug
./gradlew connectedDebugAndroidTest
```

On Windows use `gradlew.bat`. The Android directory is generated and intentionally excluded from Git. `scripts/configure-android.mjs` reproducibly applies identity, branding, release metadata, manifest, upload-signing hook and instrumentation tests. Keep private `local.properties` and keystores out of Git. Re-running sync preserves the local project. Android init on CI starts with a fresh Capacitor template.

The Android workflow builds a debug-signed APK for installation and an **unsigned** release AAB, runs lint, checks ELF LOAD alignment and installs/runs a native smoke test on an API 35 emulator. These are different from a Play pre-launch report and from a physical-phone test. APK uses the runner's debug signing key: local or future CI APKs may need uninstall/reinstall because debug certificates differ. Export data before uninstalling.

Native smoke coverage: native bridge, profile with decimal comma, save, next action, competition focus, recording a result, undo, persistence through activity recreation, email-login UI and suppression of unsupported web Google sign-in. Unit/integration coverage also includes cloud conflict guards, malformed backups, scores, offline cache and denied ad consent. Neither mocks nor UI tests prove delivery of email codes or real cross-device authentication.

## Signed upload bundle

Use your existing private upload key. If the app is new and no key exists, create and securely retain an upload key in Android Studio's Generate Signed Bundle flow. Do not share the keystore or its passwords in chat or put them into source control.

The signing hook reads these environment variables:
- `HUB_UPLOAD_KEYSTORE`: absolute path to your upload keystore.
- `HUB_UPLOAD_ALIAS`: key alias.
- `HUB_UPLOAD_STORE_PASSWORD`: keystore password.
- `HUB_UPLOAD_KEY_PASSWORD`: key password.

Run `npm run android:bundle:signed` with those variables supplied privately. This command fails if signing values are missing; it does not substitute a debug key. Verify the resulting signature with `jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab`. Upload that signed AAB to **internal testing** first. Signing certificate continuity and the version code must agree with Play Console.

## Authentication and data test requiring a real account

1. Use a dedicated test email address. Sign in with the delivered code on Android; keep credentials and codes private.
2. Create a profile, plan and goal; review and explicitly upload the device copy.
3. On a second device/browser, sign in to the same account; review and explicitly download the cloud copy. Compare profile, all nine attempt weights/results, history, goals and preferences.
4. Change device A after device B opens its cloud preview. Confirm B rejects the stale preview after A's cloud upload. Test offline failure and re-login after expiry.
5. Export on Android through the native share sheet; select a destination, reopen the JSON, preview/restore and undo. Check native report sharing too.
6. Test Android Back, keyboard visibility, rotation, very large text, airplane-mode launch and navigation, competition search including no-location mode, consent denial/privacy choices and an uninterrupted meet-day flow with ads hidden.

Native Google sign-in is deliberately **not offered** in this build. Browser Google Identity cannot be reused as native WebView login. Adding native Google needs a native sign-in plugin/client and Google OAuth Android client configured for the package and the actual Play app-signing certificate. Current Android authentication uses email codes. Browser Google sign-in remains available on the web.

## App content and reviewer access

- Public app privacy page: `/app-privacy.html` on the live app origin.
- Public account deletion request page: `/account-deletion.html`. In-app Account links to it. This is a manual email request, **not automatic server deletion**. The owner must handle requests, verify ownership and remove cloud account/profile/session data, with confirmation. Verify the operational deletion process before declaring it complete in Play Console.
- Data safety draft: optional account email/user identity, fitness/athlete profile and cloud state; optional saved city/coordinates; AdMob SDK device/ad information. Public search and service requests also disclose connection details to service providers. Confirm the actual server retention, SDK disclosures, deletion process and purposes in Console. Do not claim that no data is collected just because cloud sync is optional.
- Reviewers can use core local features without an account. For cloud review provide an approved test-access method in App access. Do not publish a fixed bypass code or weaken authentication. Email codes are short-lived; agree an accessible reviewer workflow.
- Declare ads because the native build contains AdMob, even while it requests test ads. Live monetization remains a separate release change. Configure a published AdMob consent message and verify it on a physical test device before enabling production ads.
- Complete content rating, target audience, Health apps declaration if applicable, support contact and store listing. Claims must describe tracking/planning, not medical treatment or guaranteed performance.

## Google requirements checked 6 October 2026

New app submissions target Android 16/API 36: https://support.google.com/googleplay/android-developer/answer/11926878

Personal developer accounts created after 13 November 2023 require at least 12 opted-in closed testers continuously for 14 days before requesting production access: https://support.google.com/googleplay/android-developer/answer/14151465

App signing: https://developer.android.com/studio/publish/app-signing

Account deletion and its web resource: https://support.google.com/googleplay/android-developer/answer/13327111

16 KB compatibility: https://developer.android.com/guide/practices/page-sizes — check both bundle packaging/Play analysis and runtime. The automated ELF check is one check, not a full certification.

## Release blockers until confirmed

Private upload signing key and certificate/version match; real email-code sign-in and two-device cloud round-trip; physical Android checks; owner-operated account deletion; consent and Data safety disclosures; Play Console registration/verification and applicable closed-testing requirement. Do not label the unsigned AAB “ready to upload” or call this production approval.
