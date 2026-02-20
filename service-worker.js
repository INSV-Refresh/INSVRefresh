const ICON_ACTIVE = { 128: "assets/icons/INSVRefresh.png" };
const ICON_INACTIVE = { 128: "assets/icons/INSVRefresh-grey.png" };

function setExtensionIcon(active) {
  try {
    chrome.action.setIcon({
      path: active ? ICON_ACTIVE : ICON_INACTIVE,
    });
  } catch (e) {
    console.warn("[INSV] setIcon:", e);
  }
}


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg && msg.type === "INSV_EXTENSION_ACTIVE") {
      setExtensionIcon(msg.active === true);
      sendResponse({ ok: true });
      return true;
    }
    if (msg && msg.type === "GET_EXTPAY_USER") {
      extpay.getUser().then(sendResponse).catch((err) => {
        console.error("[INSV] ExtPay getUser error:", err);
        sendResponse({ paid: false, error: err?.message || "Unknown error" });
      });
      return true;
    }
    if (msg && msg.type === "OPEN_PAYMENT_PAGE") {
      extpay.openPaymentPage().then(() => sendResponse({ ok: true })).catch((err) => {
        console.error("[INSV] ExtPay openPaymentPage error:", err);
        sendResponse({ ok: false, error: err?.message || "Unknown error" });
      });
      return true;
    }
  } catch (e) {
    console.error("[INSV] Message handler error:", e);
    sendResponse({ ok: false, error: e.message });
  }
  return false;
});

importScripts("ExtPay.js");

const extpay = ExtPay("insv-refresh");
extpay.startBackground();

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    const internalUrl = chrome.runtime.getURL("/options.html");
    chrome.tabs.create({ url: internalUrl }, () => {});
  }
  if (reason === "update") {
    const v = chrome.runtime.getManifest().version;
    chrome.storage.local.set({ pendingChangelogVersion: v });
  }
  setExtensionIcon(false);
});
