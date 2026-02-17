/* ==========================================================
   PREACHME APP.JS (2026) - FINAL PROFESSIONAL VERSION (UPGRADED)
   NETLIFY FRONTEND + RENDER BACKEND + GROQ AI

   FIXED:
   ✅ STOP BUTTON NOW WORKS PERFECTLY
   ✅ SPEECH LOOP STOPS COMPLETELY
   ✅ WAKE LOCK ENABLED (PREVENT SCREEN SLEEP WHILE READING)
   ✅ BLUE HIGHLIGHT WHILE READING
   ========================================================== */

const API_URL = "https://backend-l5n1.onrender.com/api/preach";
const TOPICS_JSON_URL = "topics.json";
const FETCH_TIMEOUT_MS = 90000;

/* ==========================================================
   MINIMUM WORD COUNTS (STRICT)
   ========================================================== */
const MIN_TEACHING_WORDS = 1000;
const MIN_PREACHING_WORDS = 500;
const MAX_AUTO_RETRIES = 4;

/* ==========================================================
   SAFE DOM SELECTOR
   ========================================================== */
function $(id) {
  return document.getElementById(id);
}

/* ==========================================================
   DOM ELEMENTS
   ========================================================== */
const topicInput = $("topicInput");
const preachBtn = $("preachBtn");

const topicDropdown = $("topicDropdown");
const preachSelectedBtn = $("preachSelectedBtn");

const chatBox = $("chatBox");

const pauseBtn = $("pauseBtn");
const resumeBtn = $("resumeBtn");
const restartBtn = $("restartBtn");
const stopBtn = $("stopBtn");
const continueBtn = $("continueBtn");

const speedRange = $("speedRange");
const speedValue = $("speedValue");

const copyChatBtn = $("copyChatBtn");
const downloadChatBtn = $("downloadChatBtn");
const clearChatBtn = $("clearChatBtn");

const voiceToggleBtn = $("voiceToggleBtn");
const listenAllBtn = $("listenAllBtn");

/* ==========================================================
   STATE VARIABLES
   ========================================================== */
let paused = false;
let lastTopicUsed = null;

let currentSermonBlock = null;
let currentSermonText = "";

/* ==========================================================
   VOICE SYSTEM STATE
   ========================================================== */
let voiceEnabled = true;
let currentUtterance = null;

/* ==========================================================
   SPEECH CONTROL STATE (NEW FIX)
   ========================================================== */
let isSpeaking = false;
let speechSentences = [];
let speechIndex = 0;

/* ==========================================================
   WAKE LOCK (PREVENT SCREEN SLEEP)
   ========================================================== */
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      console.log("✅ Wake Lock activated");

      wakeLock.addEventListener("release", () => {
        console.log("⚠️ Wake Lock released");
      });
    }
  } catch (err) {
    console.warn("⚠️ Wake Lock not supported or denied:", err);
  }
}

async function releaseWakeLock() {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
      console.log("⛔ Wake Lock released manually");
    }
  } catch (err) {
    console.warn("⚠️ Failed to release wake lock:", err);
  }
}

/* Re-request wake lock when tab becomes active again */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isSpeaking) {
    requestWakeLock();
  }
});

/* ==========================================================
   CORE UTILITIES
   ========================================================== */
function scrollChatToBottom() {
  if (!chatBox) return;
  chatBox.scrollTop = chatBox.scrollHeight;
}

function clearChat() {
  if (!chatBox) return;
  chatBox.innerHTML = "";
  currentSermonBlock = null;
  currentSermonText = "";
}

function setLoadingState(isLoading) {
  const btns = [preachBtn, preachSelectedBtn, continueBtn].filter(Boolean);
  btns.forEach(btn => (btn.disabled = isLoading));

  if (preachBtn) preachBtn.innerText = isLoading ? "PREACHING..." : "PREACH NOW 🔥";
  if (preachSelectedBtn) preachSelectedBtn.innerText = isLoading ? "PREACHING..." : "PREACH SELECTED 🔥";
  if (continueBtn) continueBtn.innerText = isLoading ? "LOADING..." : "🔥 CONTINUE PREACHING";
}

/* ==========================================================
   SYSTEM MESSAGE
   ========================================================== */
function addSystemMessage(text) {
  if (!chatBox) return;

  const msg = document.createElement("div");
  msg.className = "chat-message";

  msg.style.border = "1px solid rgba(255,215,0,0.15)";
  msg.style.background = "rgba(255,215,0,0.05)";
  msg.style.color = "#ffeab5";
  msg.style.fontWeight = "bold";

  msg.innerText = text;

  chatBox.appendChild(msg);
  scrollChatToBottom();
}

/* ==========================================================
   WORD COUNTER
   ========================================================== */
function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* ==========================================================
   BUILD FULL SERMON TEXT
   ========================================================== */
function buildFullSermonText(data) {
  const definition = (data.definition || "").trim();
  const outline = Array.isArray(data.teachingOutline) ? data.teachingOutline : [];
  const teaching = (data.teachingScript || "").trim();
  const preaching = (data.preachingScript || "").trim();

  let definitionText = "";
  let outlineText = "";

  if (definition) {
    definitionText = `📖 TOPIC DEFINITION\n${definition}\n`;
  }

  if (outline.length > 0) {
    outlineText =
      `\n📌 BIBLE TEACHING OUTLINE (10 KEY POINTS)\n` +
      outline.slice(0, 10).map((p, i) => `${i + 1}. ${p}`).join("\n") +
      `\n`;
  }

  return `
${definitionText}
${outlineText}

📖 BIBLE TEACHING
${teaching}

🔥 PROPHETIC PREACHING
${preaching}
  `.trim();
}

/* ==========================================================
   CREATE SERMON BLOCK
   ========================================================== */
function createSermonBlock(topicTitleText, sermonText) {
  if (!chatBox) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "chat-message";

  wrapper.style.padding = "14px";
  wrapper.style.borderRadius = "14px";
  wrapper.style.background = "rgba(255, 215, 0, 0.06)";
  wrapper.style.border = "1px solid rgba(255, 140, 0, 0.22)";
  wrapper.style.boxShadow = "0 0 12px rgba(255, 140, 0, 0.12)";
  wrapper.style.whiteSpace = "pre-wrap";
  wrapper.style.wordBreak = "break-word";

  const title = document.createElement("div");
  title.innerText = `🔥 TOPIC: ${topicTitleText}`;
  title.style.fontWeight = "900";
  title.style.color = "gold";
  title.style.marginBottom = "10px";
  title.style.textShadow = "0 0 10px rgba(255, 140, 0, 0.6)";

  const textDiv = document.createElement("div");
  textDiv.className = "sermon-topic-text";
  textDiv.innerText = sermonText;

  const listenBtn = document.createElement("button");
  listenBtn.className = "listen-btn";
  listenBtn.innerText = "🔊 Listen Topic Sermon";

  listenBtn.style.marginTop = "12px";
  listenBtn.style.padding = "7px 10px";
  listenBtn.style.fontSize = "0.72rem";
  listenBtn.style.borderRadius = "10px";
  listenBtn.style.fontWeight = "900";
  listenBtn.style.width = "fit-content";

  listenBtn.addEventListener("click", () => {
    speakFullText(sermonText);
  });

  wrapper.appendChild(title);
  wrapper.appendChild(textDiv);
  wrapper.appendChild(listenBtn);

  chatBox.appendChild(wrapper);
  scrollChatToBottom();

  return wrapper;
}

/* ==========================================================
   UPDATE CURRENT SERMON BLOCK TEXT
   ========================================================== */
function updateCurrentSermonBlockText(newText) {
  if (!currentSermonBlock) return;

  const textDiv = currentSermonBlock.querySelector(".sermon-topic-text");
  const listenBtn = currentSermonBlock.querySelector(".listen-btn");

  if (textDiv) textDiv.innerText = newText;

  if (listenBtn) {
    listenBtn.onclick = () => {
      speakFullText(newText);
    };
  }

  scrollChatToBottom();
}

/* ==========================================================
   STOP VOICE COMPLETELY (FIXED)
   ========================================================== */
function stopVoice() {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  currentUtterance = null;

  isSpeaking = false;
  paused = false;
  speechSentences = [];
  speechIndex = 0;

  releaseWakeLock();
}

/* ==========================================================
   SPEAK FULL TEXT WITH BLUE HIGHLIGHT (FIXED STOP SUPPORT)
   ========================================================== */
async function speakFullText(text) {
  if (!window.speechSynthesis || !voiceEnabled) return;

  stopVoice();
  paused = false;

  if (!currentSermonBlock) return;

  const textDiv = currentSermonBlock.querySelector(".sermon-topic-text");
  if (!textDiv) return;

  await requestWakeLock();

  speechSentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (speechSentences.length === 0) return;

  speechIndex = 0;
  isSpeaking = true;

  function renderHighlightedSentence() {
    const highlightedHTML = speechSentences
      .map((s, i) => {
        if (i === speechIndex) {
          return `<span class="reading-highlight">${s}</span>`;
        }
        return s;
      })
      .join(" ");

    textDiv.innerHTML = highlightedHTML;

    const highlightEl = textDiv.querySelector(".reading-highlight");
    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function speakNext() {
    if (!isSpeaking) return;
    if (paused) return;
    if (speechIndex >= speechSentences.length) {
      isSpeaking = false;
      releaseWakeLock();
      return;
    }

    renderHighlightedSentence();

    const utter = new SpeechSynthesisUtterance(speechSentences[speechIndex]);
    utter.rate = speedRange ? parseFloat(speedRange.value) : 1;
    utter.pitch = 1.05;
    utter.volume = 1;

    currentUtterance = utter;

    utter.onend = () => {
      if (!isSpeaking) return;
      speechIndex++;
      speakNext();
    };

    utter.onerror = () => {
      if (!isSpeaking) return;
      speechIndex++;
      speakNext();
    };

    window.speechSynthesis.speak(utter);
  }

  speakNext();
}

function pauseVoice() {
  if (!window.speechSynthesis) return;
  if (window.speechSynthesis.speaking) window.speechSynthesis.pause();
}

function resumeVoice() {
  if (!window.speechSynthesis) return;
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
}

/* ==========================================================
   PREACHING CONTROLS
   ========================================================== */
function stopPreaching() {
  stopVoice();
  addSystemMessage("⛔ PREACHING STOPPED COMPLETELY.");
}

function pausePreaching() {
  paused = true;
  pauseVoice();
  addSystemMessage("⏸ PREACHING PAUSED.");
}

function resumePreaching() {
  paused = false;
  resumeVoice();
  addSystemMessage("▶ PREACHING RESUMED.");
}

function restartPreaching() {
  if (!currentSermonText || currentSermonText.trim() === "") {
    alert("No sermon available to restart.");
    return;
  }

  stopVoice();
  addSystemMessage("🔁 RESTARTING SERMON VOICE...");
  speakFullText(currentSermonText);
}

/* ==========================================================
   FETCH WITH TIMEOUT
   ========================================================== */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      throw new Error("Request timed out. Backend may be waking up. Try again.");
    }

    throw err;
  }
}

/* ==========================================================
   CALL API
   ========================================================== */
async function callPreachAPI(topic, mode, previousText) {
  const response = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      mode,
      previousText
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server error (${response.status})`);
  }

  return await response.json();
}

/* ==========================================================
   START PREACHING FROM API
   ========================================================== */
async function startPreachingFromAPI(topic, mode = "new") {
  if (!topic || topic.trim() === "") {
    alert("Please type or select a topic first.");
    return;
  }

  stopVoice();
  setLoadingState(true);

  lastTopicUsed = topic;
  currentSermonBlock = null;
  currentSermonText = "";

  addSystemMessage(`🔥 GENERATING SERMON TOPIC: ${topic}`);
  addSystemMessage("⏳ Please wait...");

  try {
    const data = await callPreachAPI(topic, mode, "");

    const sermonText = buildFullSermonText(data);
    currentSermonText = sermonText;

    currentSermonBlock = createSermonBlock(topic, sermonText);

    if (voiceEnabled) {
      addSystemMessage("🔊 Auto Voice Enabled: Reading sermon now...");
      speakFullText(currentSermonText);
    }
  } catch (err) {
    console.error("API ERROR:", err);
    addSystemMessage("⚠️ ERROR: Could not generate sermon. Check backend or internet.");
  }

  setLoadingState(false);
}

/* ==========================================================
   CONTINUE PREACHING
   ========================================================== */
async function continuePreaching() {
  if (!lastTopicUsed) {
    alert("Start preaching first before continuing.");
    return;
  }

  if (!currentSermonBlock) {
    alert("No sermon block found. Generate a sermon first.");
    return;
  }

  setLoadingState(true);
  addSystemMessage("🔥 CONTINUING THIS TOPIC SERMON...");
  addSystemMessage("⏳ Please wait...");

  try {
    const data = await callPreachAPI(lastTopicUsed, "continue", currentSermonText || "");
    const continuation = (data.preachingScript || "").trim();

    if (!continuation) {
      addSystemMessage("⚠️ No continuation received.");
      setLoadingState(false);
      return;
    }

    currentSermonText += "\n\n🔥 CONTINUED PROPHETIC PREACHING\n" + continuation;
    updateCurrentSermonBlockText(currentSermonText);

    addSystemMessage("🔥 CONTINUATION RECEIVED! SERMON UPDATED.");

    if (voiceEnabled) {
      addSystemMessage("🔊 Auto Voice Enabled: Reading updated sermon...");
      speakFullText(currentSermonText);
    }
  } catch (err) {
    console.error("CONTINUE ERROR:", err);
    addSystemMessage("⚠️ Failed to continue preaching. Try again.");
  }

  setLoadingState(false);
}

/* ==========================================================
   EXPORT FUNCTIONS
   ========================================================== */
function copyChatText() {
  if (!chatBox) return;

  const text = chatBox.innerText.trim();
  if (!text) return alert("Nothing to copy.");

  navigator.clipboard.writeText(text).then(() => {
    alert("🔥 Preaching copied successfully!");
  });
}

function downloadChatText() {
  if (!chatBox) return;

  const text = chatBox.innerText.trim();
  if (!text) return alert("Nothing to download.");

  const blob = new Blob([text], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "preachme-sermon.txt";
  link.click();
}

/* ==========================================================
   LOAD DROPDOWN TOPICS
   ========================================================== */
async function loadDropdownTopicsFromJSON() {
  if (!topicDropdown) return;

  topicDropdown.innerHTML = `<option value="">⏳ Loading topics...</option>`;

  try {
    const response = await fetch(TOPICS_JSON_URL);
    if (!response.ok) throw new Error("topics.json not found");

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("topics.json is not an array");

    topicDropdown.innerHTML = `<option value="">-- Select a Topic --</option>`;

    data.forEach(obj => {
      if (!obj.title) return;

      const option = document.createElement("option");
      option.value = obj.title;
      option.textContent = `${obj.id || ""}. ${obj.title}`;
      topicDropdown.appendChild(option);
    });

    addSystemMessage(`✅ Topics Loaded: ${data.length}`);
  } catch (err) {
    console.error("TOPICS LOAD ERROR:", err);
    topicDropdown.innerHTML = `<option value="">⚠️ Failed to load topics.json</option>`;
    addSystemMessage("⚠️ Could not load topics.json.");
  }
}

/* ==========================================================
   ENTER KEY SUPPORT
   ========================================================== */
function handleEnterKey(event) {
  if (event.key !== "Enter") return;

  event.preventDefault();

  const typedTopic = topicInput ? topicInput.value.trim() : "";
  if (typedTopic) {
    startPreachingFromAPI(typedTopic, "new");
    return;
  }

  const selectedTopic = topicDropdown ? topicDropdown.value : "";
  if (selectedTopic) {
    startPreachingFromAPI(selectedTopic, "new");
    return;
  }

  alert("Type a topic or select one first!");
}

/* ==========================================================
   LISTEN ALL BUTTON
   ========================================================== */
function listenAll() {
  if (!currentSermonText || currentSermonText.trim() === "") {
    alert("No sermon topic available to listen to yet.");
    return;
  }

  speakFullText(currentSermonText);
}

/* ==========================================================
   VOICE TOGGLE
   ========================================================== */
function toggleVoice() {
  voiceEnabled = !voiceEnabled;

  if (!voiceEnabled) {
    stopVoice();
    if (voiceToggleBtn) voiceToggleBtn.innerText = "🔇 VOICE OFF";
    addSystemMessage("🔇 VOICE DISABLED.");
  } else {
    if (voiceToggleBtn) voiceToggleBtn.innerText = "🔊 VOICE ON";
    addSystemMessage("🔊 VOICE ENABLED.");
  }
}

/* ==========================================================
   SPEED CONTROL UI
   ========================================================== */
function updateVoiceSpeedUI() {
  if (!speedRange || !speedValue) return;
  const val = parseFloat(speedRange.value);
  speedValue.innerText = `${val.toFixed(1)}x`;
}

/* ==========================================================
   EVENT LISTENERS
   ========================================================== */
if (preachBtn) {
  preachBtn.addEventListener("click", () => {
    const topic = topicInput ? topicInput.value.trim() : "";
    if (!topic) return alert("Type a topic first!");
    startPreachingFromAPI(topic, "new");
  });
}

if (preachSelectedBtn) {
  preachSelectedBtn.addEventListener("click", () => {
    const topic = topicDropdown ? topicDropdown.value : "";
    if (!topic) return alert("Select a topic first!");
    startPreachingFromAPI(topic, "new");
  });
}

if (pauseBtn) pauseBtn.addEventListener("click", pausePreaching);
if (resumeBtn) resumeBtn.addEventListener("click", resumePreaching);
if (restartBtn) restartBtn.addEventListener("click", restartPreaching);
if (stopBtn) stopBtn.addEventListener("click", stopPreaching);

if (continueBtn) continueBtn.addEventListener("click", continuePreaching);

if (copyChatBtn) copyChatBtn.addEventListener("click", copyChatText);
if (downloadChatBtn) downloadChatBtn.addEventListener("click", downloadChatText);

if (clearChatBtn) {
  clearChatBtn.addEventListener("click", () => {
    stopVoice();
    clearChat();
    addSystemMessage("🗑 Chat Cleared.");
  });
}

if (topicInput) topicInput.addEventListener("keydown", handleEnterKey);
if (topicDropdown) topicDropdown.addEventListener("keydown", handleEnterKey);

if (listenAllBtn) listenAllBtn.addEventListener("click", listenAll);
if (voiceToggleBtn) voiceToggleBtn.addEventListener("click", toggleVoice);

if (speedRange) {
  speedRange.addEventListener("input", () => {
    updateVoiceSpeedUI();
  });
}

/* ==========================================================
   INIT
   ========================================================== */
window.addEventListener("load", () => {
  loadDropdownTopicsFromJSON();
  updateVoiceSpeedUI();

  addSystemMessage("🔥 PREACHME READY!");
  addSystemMessage("🔊 Auto-reading starts automatically when Voice is ON!");
  addSystemMessage("📱 Screen will stay awake while sermon is reading.");
});
