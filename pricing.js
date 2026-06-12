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
