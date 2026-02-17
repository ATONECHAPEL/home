/* =========================
   ATONE CHAPEL SCRIPT.JS (2026)
   LIVE STATUS + COUNTDOWN + MOBILE MENU
   SAFE VERSION (NO ERRORS IF ELEMENTS MISSING)
   ========================= */

/* =========================
   LIVE CONFIGURATION
   ========================= */

// NEXT LIVE DATE & TIME (Ghana Time)
const nextLiveDate = new Date("2026-02-01T04:00:00"); // EDIT THIS DATE

// MANUAL LIVE SWITCH
// true = LIVE NOW
// false = OFFLINE
const isLive = true; // CHANGE THIS WHEN GOING LIVE

/* =========================
   SAFE DOM SELECTOR
   ========================= */
function $(id) {
  return document.getElementById(id);
}

/* =========================
   ELEMENTS
   ========================= */
const liveContainer = $("liveContainer");
const offlineMessage = $("offlineMessage");
const liveStatus = $("liveStatus");
const countdownTimer = $("countdownTimer");
const whatsappAlert = $("whatsappAlert");
const navLinks = $("navLinks");

/* =========================
   LIVE / OFFLINE LOGIC
   ========================= */
function updateLiveStatus() {
  if (!liveContainer || !offlineMessage || !liveStatus) return;

  if (isLive) {
    offlineMessage.style.display = "none";
    liveContainer.style.display = "block";

    liveStatus.innerHTML =
      "<span class='live-dot'>🔴</span> <span class='live-badge'>LIVE NOW</span> — <span class='live-name'>Join Prophet Joseph Adarkwah</span>";

    if (whatsappAlert) whatsappAlert.style.display = "inline-block";
  } else {
    liveContainer.style.display = "none";
    offlineMessage.style.display = "block";

    liveStatus.innerHTML =
      "<span class='live-dot'>⚫</span> <span class='live-badge'>Currently Offline</span>";

    if (whatsappAlert) whatsappAlert.style.display = "none";
  }
}

/* =========================
   COUNTDOWN TIMER
   ========================= */
function updateCountdown() {
  if (!countdownTimer) return;

  const now = new Date().getTime();
  const distance = nextLiveDate.getTime() - now;

  if (distance <= 0) {
    countdownTimer.innerText = "🔥 We are live now!";
    return;
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((distance / (1000 * 60)) % 60);
  const seconds = Math.floor((distance / 1000) % 60);

  countdownTimer.innerText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/* =========================
   MOBILE MENU TOGGLE
   ========================= */
function toggleMenu() {
  if (!navLinks) return;

  if (navLinks.style.display === "flex") {
    navLinks.style.display = "none";
  } else {
    navLinks.style.display = "flex";
  }
}

/* =========================
   CLOSE MENU WHEN LINK CLICKED (MOBILE)
   ========================= */
function closeMenuOnClick() {
  if (!navLinks) return;

  const links = navLinks.querySelectorAll("a");
  links.forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        navLinks.style.display = "none";
      }
    });
  });
}

/* =========================
   AUTO INIT
   ========================= */
window.addEventListener("load", () => {
  updateLiveStatus();
  updateCountdown();
  closeMenuOnClick();

  setInterval(updateCountdown, 1000);
});

/* =========================
   MAKE toggleMenu GLOBAL
   (so HTML onclick works)
   ========================= */
window.toggleMenu = toggleMenu;
