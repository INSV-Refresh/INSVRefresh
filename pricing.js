function showToast(message, type) {
  if (!type) type = 'info';
  const existing = document.getElementById('pricing-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'pricing-toast';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#1e2030;color:#e0e6ff;padding:12px 18px;border-radius:8px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.35);border-left:3px solid ' + (type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#4a9eff') + ';max-width:320px;font-family:inherit;';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

function applyDarkMode(enabled) {
  document.documentElement.setAttribute("data-theme", enabled ? "dark" : "light");
}

chrome.storage.local.get("darkMode", (data) => {
  applyDarkMode(!!data.darkMode);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.darkMode) {
    applyDarkMode(!!changes.darkMode.newValue);
  }
});

document.getElementById("pay-normal-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
    if (chrome.runtime.lastError) return;
    if (access && access.level === "paid") {
      showToast(t("already_subscribed"), 'info');
      return;
    }
    chrome.runtime.sendMessage({ type: "OPEN_PAYMENT_PAGE" }, (r) => {
      if (chrome.runtime.lastError || (r && !r.ok)) window.open("https://extensionpay.com/", "_blank");
    });
  });
});

document.getElementById("start-trial-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
    if (chrome.runtime.lastError) return;
    if (access && access.level === "paid") {
      showToast(t("already_subscribed"), 'info');
      return;
    }
    if (access && access.level === "trial") {
      showToast(t("trial_already", { n: access.trialDaysLeft }), 'info');
      return;
    }
    chrome.runtime.sendMessage({ type: "OPEN_TRIAL_PAGE", period: "1 month" }, (r) => {
      if (chrome.runtime.lastError || (r && !r.ok)) window.open("https://extensionpay.com/", "_blank");
    });
  });
});

// Badge "MAIS POPULAR" vem de CSS content: attr(data-popular)
i18nReady.then(() => {
  const featured = document.querySelector(".plan-card.featured");
  if (featured) featured.setAttribute("data-popular", t("most_popular"));
});

document.addEventListener("insv-lang-changed", () => {
  const featured = document.querySelector(".plan-card.featured");
  if (featured) featured.setAttribute("data-popular", t("most_popular"));
});

document.getElementById("login-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" }, (r) => {
    if (chrome.runtime.lastError || (r && !r.ok)) window.open("https://extensionpay.com/", "_blank");
  });
});
