# Android / Google Play release preparation — 0.16.0

Package: `com.powerliftingcalculator.performancehub`. Version code: 17; version name: 0.16.0. Before upload, compare the version code with the highest code already used in your Play Console; increase `android-release.json` if needed. Minimum Android API 24, target/compile API 36. Test ads only.

## Build and test

Requirements: Node 22+, Java 21, Android SDK with API 36, accepted SDK licences.

```
npm ci
npm test
npm run android:init
cd android
./gradlew assembleDebug bundleRelease lintDebug
./gradlew :app:connectedDebugAndroidTest
```

On Windows use `gradlew.bat`. The Android directory is generated and intentionally excluded from Git. `scripts/configure-android.mjs` reproducibly applies identity, branding, release metadata, manifest, upload-signing hook and instrumentation tests. Keep private `local.properties` and keystores out of Git. Re-running sync preserves the local project. Android init on CI starts with a fresh Capacitor template.

The Android workflow builds a debug-signed APK for installation and an **unsigned** release AAB, runs lint, checks ELF LOAD alignment and installs/runs a native smoke test on an API 35 emulator. These are different from a Play pre-launch report and from a physical-phone test. APK uses the runner's debug signing key: local or future CI APKs may need uninstall/reinstall because debug certificates differ. Export data before uninstalling.

Native smoke coverage: native bridge, profile with decimal comma, save, next action, competition focus, recording a result, undo, persistence through activity recreation, email-login UI, native Google button/bridge without a web SDK, focus-mode return and privacy of prepared support reports. Unit/integration coverage also includes cloud conflict guards, malformed backups, scores, offline cache and denied ad consent. Neither mocks nor UI tests prove delivery of email codes or real cross-device authentication. A separate live web check on 6 October 2026 verified email-code sign-in, cloud upload/download, and rejection of a stale preview across two tabs in one browser. This does not replace Android email sign-in or two physical-device checks.

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

Native Google sign-in is implemented using `@capgo/capacitor-social-login` and Android Credential Manager. It requests an ID token with the existing Web OAuth client ID and sends it to the existing WordPress verifier. Web Google Identity remains browser-only; it is never loaded in native Android. Only Google is included; Facebook, Apple and Twitter are disabled.

The owner must register an **Android OAuth client** in the same Google Cloud project as the existing Web client, with package `com.powerliftingcalculator.performancehub` and the SHA-1 certificate of the APK actually installed. Obtain it with `keytool -printcert -jarfile <apk>` or `apksigner verify --print-certs <apk>`. Every ephemeral CI debug key needs its own matching registration. For Play builds, also register the **Play app-signing certificate**, rather than only the upload key. Add test users if the OAuth consent screen is in Testing. No OAuth client secret belongs in the app. Until configuration and real-device account selection/server verification pass, native Google login is **implemented but not verified operationally**. Email-code login stays available.

Settings → Help & report a problem displays the actual native app version/build, previews an optional basic diagnostic summary and opens an email draft, copies text or invokes the share sheet. It does not automatically send reports or include profile, account identifiers, tokens or saved location. The user controls the description and recipient. No automatic crash reporting was added.

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

## Live service verification — 6 October 2026

IIS intercepted OPTIONS without CORS headers. Trend Radar 1.19.1 and Hub form POST routes now carry the same expiring session credential in an HTTPS body on three restricted paths. Credentials never appear in URLs. Existing bearer-header API clients remain supported. PHP syntax and ten credential transport checks passed. Live web upload/download and stale-preview rejection passed using a synthetic Demo UX profile in an initially empty account cloud. The test leaves this synthetic profile in the account.

Android lint produced zero blocking errors and 21 warnings in the test build, mostly template/dependency/resource/icon checks. The missing data extraction rules warning should be addressed before the signed production release to explicitly exclude sessions from Android device transfer; allowBackup=false is already set. Review the full lint output with the release candidate.

## AdMob setup and diagnostics — 7 October 2026

The test APK continues to request Google test banners. The registered AdMob app ID is `ca-app-pub-0222399393353451~4434972903`; **an active publisher account is not a banner ad unit ID**. Obtain the app's Banner ad unit ID (`ca-app-pub-…/…`) from AdMob and set `admob-config.json` → `bannerAdUnitId`; change `mode` to `production` only for the production release. The build rejects malformed/sample production IDs or an app/ad-unit publisher mismatch. `adsMode` in `android-release.json` documents the release and must be kept consistent with `admob-config.json`.

Publish and verify the app's European regulations message in AdMob Privacy & messaging. UMP is updated before requests; if it reports `canRequestAds=false`, there is no ad request. Never bypass this gate to make the banner visible. Native Settings shows consent/loading/hidden/error status and a Retry button. Failed banners are removed before retry, while denied consent remains denied. Banners are deliberately hidden during onboarding, account flows and Meet Day and reserve space above mobile navigation elsewhere. Test actual delivery and CMP choices on a physical phone; mocks and emulator flow tests do not prove ad delivery.

Official references:
- https://capgo.app/docs/plugins/social-login/google/android/
- https://developers.google.com/admob/android/privacy

## Review priorities

1. **Stable signing for updates and Google login.** Replace disposable debug signing with privately managed stable test/release signing and Play App Signing registration. This prevents uninstall/reinstall data risks and repeated SHA-1 configuration.
2. **Physical-device account and monetization test.** Google account selection + backend login, delivered email code, two-device cloud round-trip, ad request/consent/denial/retry, keyboard and safe-area layout need real-device checks before release.
3. **Account deletion workflow.** Current deletion is an owner-operated email request. Verify actual deletion and response times; consider authenticated self-service deletion with confirmation.
4. **Mobile accessibility.** Check 200% font size, TalkBack labels, contrast and touch targets across score/chart tables, and swipe gestures with assistive navigation.
5. **Actionable competition data.** Show when the calendar was refreshed and improve missing-coordinate/cancelled-event reporting without treating an empty result as a network error. Feed/error separation and manual-location fallback already exist.
