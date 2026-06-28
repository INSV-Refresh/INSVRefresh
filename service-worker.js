importScripts("ExtPay.js");

const extpay = ExtPay("insv-refresh");
extpay.startBackground();

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


// ── Nível de acesso (free / trial / paid) ───────────────────
// Fonte única da regra de acesso, usada por popup, options e gridRefresh
// via mensagem GET_ACCESS_LEVEL. Usuário em trial é tratado como pago.
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 1 mês

function computeAccessLevel(user) {
  if (user && user.paid) {
    return { level: "paid", isPaid: true, trialDaysLeft: 0 };
  }
  if (user && user.trialStartedAt) {
    const startedAt = new Date(user.trialStartedAt).getTime();
    const elapsed = Date.now() - startedAt;
    if (!isNaN(startedAt) && elapsed >= 0 && elapsed < TRIAL_DURATION_MS) {
      const trialDaysLeft = Math.max(1, Math.ceil((TRIAL_DURATION_MS - elapsed) / (24 * 60 * 60 * 1000)));
      return { level: "trial", isPaid: true, trialDaysLeft };
    }
  }
  return { level: "free", isPaid: false, trialDaysLeft: 0 };
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
    if (msg && msg.type === "GET_ACCESS_LEVEL") {
      extpay.getUser().then((user) => {
        sendResponse(computeAccessLevel(user));
      }).catch((err) => {
        console.error("[INSV] ExtPay getUser error:", err);
        sendResponse({ level: "free", isPaid: false, trialDaysLeft: 0, error: err?.message || "Unknown error" });
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
    if (msg && msg.type === "OPEN_TRIAL_PAGE") {
      extpay.openTrialPage(msg.period || "1 month").then(() => sendResponse({ ok: true })).catch((err) => {
        console.error("[INSV] ExtPay openTrialPage error:", err);
        sendResponse({ ok: false, error: err?.message || "Unknown error" });
      });
      return true;
    }
    if (msg && msg.type === "OPEN_LOGIN_PAGE") {
      extpay.openLoginPage().then(() => sendResponse({ ok: true })).catch((err) => {
        console.error("[INSV] ExtPay openLoginPage error:", err);
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

// ── Migração de storage (idempotente, versionada) ───────────
// Roda no install/update e converte shapes antigos:
//   v2: popupDarkMode → darkMode; advanced.acceptShortcutKey (string)
//       → advanced.acceptShortcut (objeto); statusNotifications[] →
//       queues[].statusNotify; poda analytics.
// Obs.: legacyMode/legacyInterval/legacyActive ficam em storage.sync
// (acompanham o usuário entre dispositivos); queues e demais configs
// ficam em storage.local (são por máquina) — decisão documentada aqui
// para manter a inconsistência intencional visível.
const STORAGE_VERSION = 2;

function legacyKeyToShortcutObj(key) {
  const k = (key || "").trim();
  if (!k) return null;
  let code = k;
  if (/^[a-z]$/i.test(k)) code = "Key" + k.toUpperCase();
  else if (/^[0-9]$/.test(k)) code = "Digit" + k;
  return { ctrl: false, alt: false, shift: false, meta: false, code, legacy: true };
}

function mergeStatusNotificationsIntoQueues(queues, legacy) {
  (legacy || []).forEach((sn) => {
    const name = (sn.queueName || "").trim();
    if (!name) return;
    let q = queues.find((x) => (x.name || "").toLowerCase().trim() === name.toLowerCase());
    if (!q) {
      q = { name, active: false, interval: 15, soundEnabled: false, customSound: "notification.mp3" };
      queues.push(q);
    }
    q.statusNotify = {
      enabled: !!sn.enabled,
      statuses: sn.statuses || [],
      sound: sn.sound || "notification.mp3",
    };
  });
  return queues;
}

function migrateStorage() {
  chrome.storage.local.get(null, (data) => {
    if ((data.storageVersion || 0) >= STORAGE_VERSION) return;

    const updates = { storageVersion: STORAGE_VERSION };
    const removals = [];

    // Dark mode unificado
    if (data.darkMode === undefined && data.popupDarkMode !== undefined) {
      updates.darkMode = !!data.popupDarkMode;
    }
    if (data.popupDarkMode !== undefined) removals.push("popupDarkMode");

    // Atalho de aceitar: string antiga → objeto estruturado
    if (data.advanced && (data.advanced.acceptShortcutKey || data.advanced.acceptShortcut === undefined)) {
      const adv = Object.assign({}, data.advanced);
      if (!adv.acceptShortcut && adv.acceptShortcutKey) {
        const sc = legacyKeyToShortcutObj(adv.acceptShortcutKey);
        if (sc) adv.acceptShortcut = sc;
      }
      delete adv.acceptShortcutKey;
      updates.advanced = adv;
    }

    // statusNotifications[] legado → queues[].statusNotify
    if (data.statusNotifications && data.statusNotifications.length) {
      updates.queues = mergeStatusNotificationsIntoQueues(data.queues || [], data.statusNotifications);
    }
    if (data.statusNotifications !== undefined) removals.push("statusNotifications");

    // Analytics removed — purge any leftover blob from older versions
    if (data.analytics !== undefined) removals.push("analytics");

    chrome.storage.local.set(updates, () => {
      if (removals.length) chrome.storage.local.remove(removals);
    });
  });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    const internalUrl = chrome.runtime.getURL("options.html");
    chrome.tabs.create({ url: internalUrl }, () => {});
  }
  if (reason === "update") {
    const v = chrome.runtime.getManifest().version;
    chrome.storage.local.set({ pendingChangelogVersion: v });
  }
  migrateStorage();
  setExtensionIcon(false);
});
