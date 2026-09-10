const params = new URLSearchParams(location.search);
document.getElementById("site").textContent = params.get("site") || "This site";

document.getElementById("back-btn").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
  } else {
    // Tab was opened directly on the blocked site — nothing to go back to, so close it.
    chrome.tabs.getCurrent((tab) => {
      if (tab && tab.id !== undefined) chrome.tabs.remove(tab.id);
    });
  }
});