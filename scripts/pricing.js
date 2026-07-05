// showToast + applyDarkMode/watchDarkMode are shared from util.js.
watchDarkMode();

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
