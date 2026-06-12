document.getElementById("pay-normal-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "GET_ACCESS_LEVEL" }, (access) => {
    if (chrome.runtime.lastError) return;
    if (access && access.level === "paid") {
      window.alert("Você já é assinante. Aproveite todos os recursos!");
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
      window.alert("Você já é assinante. Aproveite todos os recursos!");
      return;
    }
    if (access && access.level === "trial") {
      window.alert(`Seu teste grátis já está ativo. Restam ${access.trialDaysLeft} dia(s).`);
      return;
    }
    chrome.runtime.sendMessage({ type: "OPEN_TRIAL_PAGE", period: "1 month" }, (r) => {
      if (chrome.runtime.lastError || (r && !r.ok)) window.open("https://extensionpay.com/", "_blank");
    });
  });
});

document.getElementById("login-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" }, (r) => {
    if (chrome.runtime.lastError || (r && !r.ok)) window.open("https://extensionpay.com/", "_blank");
  });
});
