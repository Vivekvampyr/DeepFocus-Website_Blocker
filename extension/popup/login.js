const guestBtn = document.getElementById("guest-btn");
const loginBtn = document.getElementById("login-btn");

guestBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({
    authMode: "guest"
  });

  window.location.href = "popup.html";
});

loginBtn.addEventListener("click", () => {
  window.location.href = chrome.runtime.getURL(
    "popup/login-form.html"
  );
});