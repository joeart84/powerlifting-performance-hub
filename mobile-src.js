import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize
} from "@capacitor-community/admob";

const ADMOB_BANNER_ID_ANDROID = "ca-app-pub-3940256099942544/6300978111";
let initialized = false;
let bannerCreated = false;
let bannerHidden = false;
let consentDebugResetDone = false;
let bannerListenersReady = false;

function setAdDebugStatus(message) {
  console.info("[AdMob]", message);
  let badge = document.getElementById("admobDebugStatus");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "admobDebugStatus";
    badge.setAttribute("role", "status");
    badge.style.cssText = [
      "position:fixed",
      "right:8px",
      "top:52px",
      "z-index:2147483647",
      "max-width:78vw",
      "padding:6px 9px",
      "border-radius:8px",
      "background:rgba(10,13,16,.88)",
      "border:1px solid rgba(255,255,255,.18)",
      "color:#dfe6ea",
      "font:11px/1.35 system-ui,sans-serif",
      "pointer-events:none"
    ].join(";");
    document.body.appendChild(badge);
  }
  badge.textContent = `AdMob debug: ${message}`;
}

async function ensureBannerDebugListeners() {
  if (bannerListenersReady) return;
  bannerListenersReady = true;

  await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    console.info("[AdMob] banner loaded");
    setAdDebugStatus("banner loaded");
    reserveBannerSpace(true);
  });

  await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
    console.error("[AdMob] banner failed to load", error);
    const message = error?.message || error?.code || JSON.stringify(error);
    setAdDebugStatus(`banner failed: ${message}`);
    reserveBannerSpace(false);
  });

  await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    console.info("[AdMob] banner size changed", size);
  });

  await AdMob.addListener(BannerAdPluginEvents.AdImpression, () => {
    console.info("[AdMob] banner impression");
    setAdDebugStatus("banner impression recorded");
  });
}

function activeTabName() {
  const active = document.querySelector("[data-tab].active");
  return active?.dataset?.tab || "";
}

function shouldHideAd() {
  const tab = activeTabName();
  return tab === "meetday" || tab === "account";
}

function reserveBannerSpace(enabled) {
  document.documentElement.style.setProperty("--native-ad-space", enabled ? "72px" : "0px");
}

async function ensureBanner() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  if (shouldHideAd()) {
    if (bannerCreated && !bannerHidden) {
      await AdMob.hideBanner();
      bannerHidden = true;
    }
    reserveBannerSpace(false);
    return;
  }

  if (!initialized) {
    setAdDebugStatus("initializing");
    await AdMob.initialize();
    initialized = true;
    await ensureBannerDebugListeners();

    if (!consentDebugResetDone) {
      try {
        await AdMob.resetConsentInfo();
        consentDebugResetDone = true;
        setAdDebugStatus("consent reset");
      } catch (error) {
        console.warn("[AdMob] consent reset failed", error);
      }
    }

    let consentInfo = await AdMob.requestConsentInfo();
    console.info("[AdMob] consent info", consentInfo);
    setAdDebugStatus(
      `consent status=${String(consentInfo.status)} · form=${Boolean(consentInfo.isConsentFormAvailable)} · ads=${Boolean(consentInfo.canRequestAds)}`
    );

    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdmobConsentStatus.REQUIRED
    ) {
      setAdDebugStatus("showing consent form");
      consentInfo = await AdMob.showConsentForm();
      console.info("[AdMob] consent after form", consentInfo);
      setAdDebugStatus(
        `after consent · status=${String(consentInfo.status)} · ads=${Boolean(consentInfo.canRequestAds)}`
      );
    }

    if (!consentInfo.canRequestAds) {
      setAdDebugStatus("ads blocked by consent state");
      return;
    }
  }

  if (!bannerCreated) {
    setAdDebugStatus("requesting test banner");
    await AdMob.showBanner({
      adId: ADMOB_BANNER_ID_ANDROID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true
    });
    bannerCreated = true;
    bannerHidden = false;
    setAdDebugStatus("test banner request sent");
  } else if (bannerHidden) {
    await AdMob.resumeBanner();
    bannerHidden = false;
  }

  reserveBannerSpace(true);
}

function syncBannerVisibility() {
  ensureBanner().catch((error) => {
    console.error("[AdMob] banner error", error);
    const message = error?.message || error?.code || String(error);
    setAdDebugStatus(`error: ${message}`);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.textContent = "body{padding-bottom:var(--native-ad-space,0px)!important;transition:padding-bottom .18s ease}";
  document.head.appendChild(style);

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-tab]")) {
      setTimeout(syncBannerVisibility, 0);
    }
  });

  const accountSection = document.getElementById("tab-account");
  if (accountSection) {
    new MutationObserver(syncBannerVisibility).observe(accountSection, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  setTimeout(syncBannerVisibility, 500);
});
