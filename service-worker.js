chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    let internalUrl = chrome.runtime.getURL("/options.html");
    chrome.tabs.create({ url: internalUrl }, function (tab) {
      console.log("New tab launched with /options.html");
    });
  }
});
