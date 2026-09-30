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
let bannerListenersReady = false;

async function ensureBannerDebugListeners() {
  if (bannerListenersReady) return;
  bannerListenersReady = true;

  await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    console.info("[AdMob] banner loaded");
    reserveBannerSpace(60);
  });

  await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
    console.error("[AdMob] banner failed to load", error);
    reserveBannerSpace(0);
  });

  await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    console.info("[AdMob] banner size changed", size);
    reserveBannerSpace(size?.height || 60);
  });

  await AdMob.addListener(BannerAdPluginEvents.AdImpression, () => {
    console.info("[AdMob] banner impression");
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

function reserveBannerSpace(height = 0) {
  const pixels = Math.max(0, Math.round(Number(height) || 0));
  document.documentElement.style.setProperty("--native-ad-space", `${pixels}px`);
}

async function ensureBanner() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  if (shouldHideAd()) {
    if (bannerCreated && !bannerHidden) {
      await AdMob.hideBanner();
      bannerHidden = true;
    }
    reserveBannerSpace(0);
    return;
  }

  if (!initialized) {
    await AdMob.initialize();
    initialized = true;
    await ensureBannerDebugListeners();

    let consentInfo = await AdMob.requestConsentInfo();
    console.info("[AdMob] consent info", consentInfo);

    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdmobConsentStatus.REQUIRED
    ) {
      consentInfo = await AdMob.showConsentForm();
      console.info("[AdMob] consent after form", consentInfo);
    }

    if (!consentInfo.canRequestAds) {
      console.info("[AdMob] ads blocked by consent state");
      return;
    }
  }

  if (!bannerCreated) {
    console.info("[AdMob] requesting test banner");
    await AdMob.showBanner({
      adId: ADMOB_BANNER_ID_ANDROID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true
    });
    bannerCreated = true;
    bannerHidden = false;
  } else if (bannerHidden) {
    await AdMob.resumeBanner();
    bannerHidden = false;
  }

  reserveBannerSpace(60);
}

function syncBannerVisibility() {
  ensureBanner().catch((error) => {
    console.error("[AdMob] banner error", error);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.textContent = [
    "body{padding-bottom:var(--native-ad-space,0px)!important;transition:padding-bottom .18s ease}",
    "@media(max-width:760px){",
    ".primaryNav{bottom:calc(var(--native-ad-space,0px) + 40px + env(safe-area-inset-bottom,0px))!important;transition:bottom .18s ease}",
    ".shell{padding-bottom:24px!important}",
    "footer{padding-bottom:calc(92px + var(--native-ad-space,0px) + env(safe-area-inset-bottom,0px))!important}",
    "}"
  ].join("");
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
