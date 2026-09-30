import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize
} from "@capacitor-community/admob";

const TEST_BANNER_ID_ANDROID = "ca-app-pub-3940256099942544/6300978111";
let initialized = false;
let bannerCreated = false;
let bannerHidden = false;

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
    await AdMob.initialize();
    initialized = true;

    let consentInfo = await AdMob.requestConsentInfo();
    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdmobConsentStatus.REQUIRED
    ) {
      consentInfo = await AdMob.showConsentForm();
    }
    if (!consentInfo.canRequestAds) return;
  }

  if (!bannerCreated) {
    await AdMob.showBanner({
      adId: TEST_BANNER_ID_ANDROID,
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

  reserveBannerSpace(true);
}

function syncBannerVisibility() {
  ensureBanner().catch((error) => console.warn("AdMob test banner:", error));
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
