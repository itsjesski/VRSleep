/**
 * Renderer Process.
 * Manages the UI state, user interactions, and bridges data between the user and the main process.
 */

window.onerror = function (message, _source, lineno, colno, error) {
  appendLog(`UI Error: ${message} at ${lineno}:${colno}`);
  console.error(error);
};

// --- DOM Elements: Views & Headers ---
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const userHeader = document.getElementById("user-header");
const userDisplayName = document.getElementById("user-display-name");
const authHint = document.getElementById("auth-hint");

// --- DOM Elements: Whitelist & Logs ---
const whitelistInput = document.getElementById("whitelist");
const whitelistStatus = document.getElementById("whitelist-status");
const manageWhitelistButton = document.getElementById("manage-whitelist");
const logList = document.getElementById("log");

// --- DOM Elements: Sleep Mode Controls ---
const statusBadge = document.getElementById("status");
const toggleButton = document.getElementById("toggle");
const autoStatusToggle = document.getElementById("auto-status-toggle");
const sleepStatus = document.getElementById("sleep-status");
const sleepStatusDescription = document.getElementById(
  "sleep-status-description",
);

// --- DOM Elements: Customization Controls ---
const inviteMessageToggle = document.getElementById("invite-message-toggle");
const inviteMessageSlot = document.getElementById("invite-message-slot");
const inviteSlotPreview = document.getElementById("invite-slot-preview");
const applySlotButton = document.getElementById("apply-slot");
const statusCharCount = document.getElementById("status-char-count");
const inviteCharCount = document.getElementById("invite-char-count");

// --- DOM Elements: Modals & Tabs ---
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalHint = document.getElementById("modal-hint");
const modalCode = document.getElementById("modal-code");
const modalSubmit = document.getElementById("modal-submit");
const modalToggle = document.getElementById("modal-toggle");

const friendsModal = document.getElementById("friends-modal");
const friendsSearch = document.getElementById("friends-search");
const friendsList = document.getElementById("friends-list");
const friendsSave = document.getElementById("friends-save");
const friendsClose = document.getElementById("friends-close");

const tabWhitelist = document.getElementById("tab-whitelist");
const tabCustomizations = document.getElementById("tab-customizations");
const tabActivity = document.getElementById("tab-activity");
const contentWhitelist = document.getElementById("content-whitelist");
const contentCustomizations = document.getElementById("content-customizations");
const contentActivity = document.getElementById("content-activity");

// --- DOM Elements: Utilities ---
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const updateButton = document.getElementById("update-btn");

// --- Application State ---
const STATUS_COLORS = {
  none: "#9ca3af",
  "join me": "#42CAFF",
  active: "#51E57E",
  "ask me": "#E8B138",
  busy: "#C93131",
};

let currentUser = null;
let twoFactorType = "totp";
let twoFactorMethods = [];
let allFriends = [];
let selectedFriends = new Set();
let cachedSlotsData = {
  message: [],
  response: [],
  request: [],
  requestResponse: [],
};
let slotCooldowns = {
  message: {},
  response: {},
  request: {},
  requestResponse: {},
};

// Timers & Flags
let saveTimer = null;
let settingsTimer = null;
let autoStatusEnabled = false;
let inviteMessageEnabled = false;
let isApplying = false;

// --- UI Helpers ---

/**
 * Switches between the Login and Main views.
 */
function showView(view) {
  loginView.classList.remove("active");
  mainView.classList.remove("active");
  view.classList.add("active");
}

/**
 * Updates the Sleep Mode status badge and toggle button text.
 */
function setStatus(enabled) {
  statusBadge.textContent = enabled ? "Enabled" : "Disabled";
  statusBadge.className = enabled ? "status on" : "status off";
  toggleButton.textContent = enabled
    ? "Disable Sleep Mode"
    : "Enable Sleep Mode";
  toggleButton.className = enabled ? "secondary" : "primary";
}

/**
 * Adds a timestamped entry to the activity log.
 */
function appendLog(message) {
  const item = document.createElement("div");
  item.className = "log-item";
  const timestamp = new Date().toLocaleTimeString();
  item.textContent = `[${timestamp}] ${message}`;
  logList.prepend(item);
}

/**
 * Updates the visual save-status of the whitelist.
 */
function setWhitelistStatus(text, state = "saved") {
  whitelistStatus.textContent = text;
  whitelistStatus.className = `status ${state}`;
}

/**
 * Displays error or hint messages on the login screen.
 */
function setAuthHint(message, isError = false) {
  authHint.textContent = message || "";
  authHint.style.color = isError ? "#f87171" : "#9ca3af";
}

/**
 * Configures the UI based on the current user's session.
 */
function setUserInfo(user) {
  currentUser = user;
  if (user) {
    userDisplayName.textContent = user.displayName || user.username || "User";
    userHeader.style.display = "flex";
    showView(mainView);
  } else {
    userHeader.style.display = "none";
    showView(loginView);
  }
}

/**
 * Toggles the visibility of the 2FA verification modal.
 */
function setModalState(visible) {
  if (visible) modal.classList.add("active");
  else modal.classList.remove("active");
}

/**
 * Updates the text content of the 2FA modal based on the required method.
 */
function updateModalCopy() {
  if (twoFactorType === "email") {
    modalTitle.textContent = "Email verification";
    modalHint.textContent = "Enter the 6-digit code sent to your email.";
    modalToggle.textContent = "Use backup code";
  } else if (twoFactorType === "otp") {
    modalTitle.textContent = "Backup code";
    modalHint.textContent = "Enter your recovery code (xxxx-xxxx).";
    modalToggle.textContent = twoFactorMethods.includes("emailOtp")
      ? "Use email code"
      : "Use authenticator";
  } else {
    modalTitle.textContent = "Authenticator code";
    modalHint.textContent =
      "Enter the 6-digit code from your authenticator app.";
    modalToggle.textContent = "Use backup code";
  }
}

// --- Data Synchronization ---

/**
 * Verifies the current session with the main process.
 */
async function refreshAuthStatus() {
  try {
    const status = await window.sleepchat.getAuthStatus();
    if (status.authenticated) {
      if (status.user) {
        setUserInfo(status.user);
      } else {
        setUserInfo({ id: status.userId, displayName: "Loading..." });
        window.sleepchat.getCurrentUser().then((res) => {
          if (res.ok && res.user) setUserInfo(res.user);
        });
      }
      return true;
    }
    setUserInfo(null);
    return false;
  } catch (error) {
    console.error("Auth refresh failed:", error);
    setUserInfo(null);
    return false;
  }
}

/**
 * Loads the whitelist from local storage.
 */
async function loadWhitelist() {
  const list = await window.sleepchat.getWhitelist();
  whitelistInput.value = list.join("\n");
  setWhitelistStatus("Saved");
}

/**
 * Saves the current whitelist to local storage.
 */
async function saveWhitelist() {
  const list = whitelistInput.value
    .split("\n")
    .map((e) => e.trim())
    .filter(Boolean);
  await window.sleepchat.setWhitelist(list);
  setWhitelistStatus("Saved", "saved");
  appendLog(
    list.length > 0 ? `Whitelist: ${list.join(", ")}` : "Whitelist cleared.",
  );
}

/**
 * Debounces whitelist saving to prevent excessive disk writes.
 */
function scheduleAutoSave() {
  setWhitelistStatus("Unsaved", "unsaved");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    setWhitelistStatus("Saving...", "saving");
    await saveWhitelist();
  }, 1000);
}

/**
 * Persists the application's configuration settings.
 */
async function saveSettings() {
  const activeTab = tabWhitelist.classList.contains("active")
    ? "whitelist"
    : tabCustomizations.classList.contains("active")
      ? "customizations"
      : "activity";

  const settings = {
    sleepStatus: sleepStatus.value || "none",
    sleepStatusDescription: sleepStatusDescription.value || "",
    inviteMessageSlot: Number(inviteMessageSlot.value) || 0,
    inviteMessageType: "message",
    autoStatusEnabled,
    inviteMessageEnabled,
    activeTab,
  };

  await window.sleepchat.setSettings(settings);
}

/**
 * Debounces settings saving to minimize IPC traffic.
 */
function scheduleSettingsSave() {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(saveSettings, 2000);
}

// --- VRChat Customization Logic ---

/**
 * Updates the 'Apply' button state based on cooldowns, duplicates, and loading status.
 */
function updateApplyButtonState() {
  const type = "message";
  const slot = Number(inviteMessageSlot.value);

  // Guard: Do not overwrite the button while an operation is in progress.
  if (isApplying) {
    return;
  }

  // If the button text is stuck on a loading state but we aren't applying, reset it.
  if (
    ["Applying...", "Checking...", "Loading..."].includes(
      applySlotButton.textContent,
    )
  ) {
    applySlotButton.textContent = "Apply";
  }

  const unlockTime = slotCooldowns[type]?.[slot] || 0;
  const now = Date.now();

  const currentSlotData = cachedSlotsData[type]?.[slot] || null;
  const currentVrcMessage = currentSlotData
    ? typeof currentSlotData.message === "string"
      ? currentSlotData.message
      : ""
    : null;

  // Rule: Button grays out if data is missing, matches VRChat, or is on cooldown.
  const isDuplicate =
    currentVrcMessage === null || inviteSlotPreview.value === currentVrcMessage;

  if (unlockTime > now) {
    const remainingSeconds = Math.ceil((unlockTime - now) / 1000);
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    applySlotButton.disabled = true;
    applySlotButton.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    applySlotButton.classList.add("countdown-mode");
    applySlotButton.classList.remove("primary");
  } else if (isDuplicate) {
    applySlotButton.disabled = true;
    applySlotButton.textContent = "Apply";
    applySlotButton.classList.remove("countdown-mode", "primary");
    applySlotButton.classList.add("secondary");
  } else {
    applySlotButton.disabled = false;
    applySlotButton.textContent = "Apply";
    applySlotButton.classList.remove("countdown-mode", "secondary");
    applySlotButton.classList.add("primary");
  }
}

/**
 * UI Heartbeat: Updates the 'Apply' button countdown every 500ms.
 */
setInterval(() => {
  updateApplyButtonState();
}, 500);

/**
 * Background Polling: Refreshes ONLY the currently selected slot every 60 seconds.
 * This keeps the UI in sync without fetching all 12 slots unnecessarily.
 */
setInterval(async () => {
  if (currentUser && !isApplying) {
    const type = "message";
    try {
      const result = await window.sleepchat.getMessageSlot(
        type,
        Number(inviteMessageSlot.value),
      );
      if (result.ok) {
        const slot = Number(inviteMessageSlot.value);
        if (!cachedSlotsData[type]) {
          cachedSlotsData[type] = Array(12)
            .fill("")
            .map((_, i) => ({ slot: i, message: "" }));
        }
        const data = result.slotData;
        const message = typeof data === "string" ? data : data?.message || "";
        cachedSlotsData[type][slot] = { slot, message };

        const cooldowns = await window.sleepchat.getCooldowns();
        if (cooldowns) slotCooldowns = cooldowns;
        updateSlotPreviews();
      }
    } catch (e) {
      console.error("Background poll failed:", e);
    }
  }
}, 60000);

/**
 * Fetches data for the specifically selected message slot from the API.
 */
async function fetchSlots() {
  const type = "message";
  const slot = Number(inviteMessageSlot.value);

  try {
    const result = await window.sleepchat.getMessageSlot(type, slot);
    if (result.ok) {
      const data = result.slotData;
      const message = typeof data === "string" ? data : data?.message || "";

      if (!cachedSlotsData[type]) {
        cachedSlotsData[type] = Array(12)
          .fill("")
          .map((_, i) => ({ slot: i, message: "" }));
      }
      cachedSlotsData[type][slot] = { slot, message };

      const cooldowns = await window.sleepchat.getCooldowns();
      if (cooldowns) slotCooldowns = cooldowns;

      updateSlotPreviews();
    }
  } catch (error) {
    console.error("Slot fetch failed:", error);
  } finally {
    updateApplyButtonState();
  }
}

/**
 * Populates all 48 slots sequentially. Used only when local cache is empty.
 */
async function fetchAllSlotsSequentially() {
  const types = ["message"];
  for (const type of types) {
    try {
      const result = await window.sleepchat.getMessageSlots(type);
      if (result.ok && Array.isArray(result.messages)) {
        cachedSlotsData[type] = result.messages;
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`Fetch failed for ${type}:`, e);
    }
  }
  updateSlotPreviews();
}

/**
 * Updates the UI preview box and character counts for the selected slot.
 */
function updateSlotPreviews() {
  const type = "message";
  const slot = Number(inviteMessageSlot.value);
  const slotData = cachedSlotsData[type]?.[slot];

  inviteSlotPreview.value = slotData
    ? typeof slotData.message === "string"
      ? slotData.message
      : ""
    : "";

  const len = inviteSlotPreview.value.length;
  inviteCharCount.textContent = `${len}/64`;
  inviteCharCount.style.color = len >= 64 ? "#f87171" : "var(--color-muted)";

  updateApplyButtonState();
}

/**
 * Renders the friends selection list within the whitelist modal.
 */
function renderFriendsList(friends) {
  friendsList.innerHTML = "";
  if (friends.length === 0) {
    friendsList.innerHTML =
      '<div style="padding: 20px; text-align: center; color: var(--color-muted);">No friends found</div>';
    return;
  }

  friends.forEach((friend) => {
    const item = document.createElement("div");
    item.className = `friend-item ${selectedFriends.has(friend.id) ? "selected" : ""}`;

    const avatar = document.createElement("img");
    avatar.className = "friend-avatar";
    avatar.src = friend.thumbnailUrl || "";
    avatar.onerror = () => (avatar.style.display = "none");

    const info = document.createElement("div");
    info.className = "friend-info";
    info.innerHTML = `<div class="friend-name">${friend.displayName}</div><div class="friend-status">${friend.statusDescription || friend.status}</div>`;

    item.appendChild(avatar);
    item.appendChild(info);
    item.addEventListener("click", () => {
      if (selectedFriends.has(friend.id)) {
        selectedFriends.delete(friend.id);
        item.classList.remove("selected");
      } else {
        selectedFriends.add(friend.id);
        item.classList.add("selected");
      }
    });
    friendsList.appendChild(item);
  });
}

// --- Event Listeners: Navigation ---

function setActiveTab(tabName) {
  tabWhitelist.classList.toggle("active", tabName === "whitelist");
  tabCustomizations.classList.toggle("active", tabName === "customizations");
  tabActivity.classList.toggle("active", tabName === "activity");

  contentWhitelist.classList.toggle("active", tabName === "whitelist");
  contentCustomizations.classList.toggle(
    "active",
    tabName === "customizations",
  );
  contentActivity.classList.toggle("active", tabName === "activity");

  scheduleSettingsSave();
}

tabWhitelist.addEventListener("click", () => setActiveTab("whitelist"));
tabActivity.addEventListener("click", () => setActiveTab("activity"));
tabCustomizations.addEventListener("click", () => {
  setActiveTab("customizations");
  if (currentUser) fetchSlots();
});

// --- Event Listeners: Whitelist & Friends ---

whitelistInput.addEventListener("input", scheduleAutoSave);

manageWhitelistButton.addEventListener("click", async () => {
  appendLog("Loading friends list...");
  const result = await window.sleepchat.getFriends();
  if (!result.ok) return appendLog(`Failed: ${result.error}`);

  allFriends = result.friends;
  const current = whitelistInput.value.toLowerCase();
  selectedFriends.clear();
  allFriends.forEach((f) => {
    if (
      current.includes(f.id.toLowerCase()) ||
      current.includes(f.displayName.toLowerCase())
    ) {
      selectedFriends.add(f.id);
    }
  });

  renderFriendsList(allFriends);
  friendsModal.classList.add("active");
});

friendsSearch.addEventListener("input", () => {
  const q = friendsSearch.value.toLowerCase();
  renderFriendsList(
    allFriends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q),
    ),
  );
});

friendsSave.addEventListener("click", () => {
  const selectedNames = allFriends
    .filter((f) => selectedFriends.has(f.id))
    .map((f) => f.displayName);
  const existing = whitelistInput.value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const existingLower = existing.map((e) => e.toLowerCase());
  const newOnes = selectedNames.filter(
    (n) => !existingLower.includes(n.toLowerCase()),
  );

  whitelistInput.value = [...existing, ...newOnes].join("\n");
  scheduleAutoSave();
  friendsModal.classList.remove("active");
  appendLog(
    newOnes.length > 0
      ? `Added ${newOnes.length} friends.`
      : "No new friends added.",
  );
});

friendsClose.addEventListener("click", () =>
  friendsModal.classList.remove("active"),
);

// --- Event Listeners: Settings & Customization ---

autoStatusToggle.addEventListener("change", () => {
  autoStatusEnabled = autoStatusToggle.checked;
  scheduleSettingsSave();
});

inviteMessageToggle.addEventListener("change", () => {
  inviteMessageEnabled = inviteMessageToggle.checked;
  scheduleSettingsSave();
});

sleepStatus.addEventListener("change", () => {
  sleepStatus.style.color = STATUS_COLORS[sleepStatus.value] || "#e3e5e8";
  scheduleSettingsSave();
});

sleepStatusDescription.addEventListener("input", () => {
  const len = sleepStatusDescription.value.length;
  statusCharCount.textContent = `${len}/32`;
  statusCharCount.style.color = len >= 32 ? "#f87171" : "var(--color-muted)";
  scheduleSettingsSave();
});

inviteMessageSlot.addEventListener("change", async () => {
  await fetchSlots();
  updateApplyButtonState();
  scheduleSettingsSave();
});

inviteSlotPreview.addEventListener("input", () => {
  const len = inviteSlotPreview.value.length;
  inviteCharCount.textContent = `${len}/64`;
  inviteCharCount.style.color = len >= 64 ? "#f87171" : "var(--color-muted)";
  updateApplyButtonState();
});

applySlotButton.addEventListener("click", async () => {
  const type = "message";
  const slot = Number(inviteMessageSlot.value);
  const message = inviteSlotPreview.value;

  isApplying = true;
  applySlotButton.disabled = true;
  applySlotButton.textContent = "Applying...";

  try {
    const result = await window.sleepchat.updateMessageSlot(
      type,
      slot,
      message,
    );
    if (!result.ok) throw new Error(result.error);

    if (Array.isArray(result.result)) {
      cachedSlotsData[type] = result.result;
      const cooldowns = await window.sleepchat.getCooldowns();
      if (cooldowns) slotCooldowns = cooldowns;
      appendLog(`Updated Slot ${slot + 1}.`);
      updateSlotPreviews();
    } else {
      appendLog(`Error: Unexpected response format from API.`);
    }
  } catch (e) {
    appendLog(`Error: ${e.message}`);
  } finally {
    isApplying = false;
    updateApplyButtonState();
  }
});

// --- Event Listeners: Authentication ---

loginButton.addEventListener("click", async () => {
  setAuthHint("");
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) return setAuthHint("Required.", true);

  loginButton.disabled = true;
  try {
    const res = await window.sleepchat.login(username, password);
    if (!res.ok) return setAuthHint(res.error || "Failed.", true);

    if (res.result?.status === "2fa") {
      twoFactorMethods = res.result.methods || [];
      twoFactorType = twoFactorMethods.includes("emailOtp") ? "email" : "totp";
      updateModalCopy();
      setModalState(true);
    } else {
      passwordInput.value = "";
      const isAuthenticated = await refreshAuthStatus();
      if (isAuthenticated) {
        const hasCache = await loadCachedSlots();
        if (!hasCache) await fetchAllSlotsSequentially();
        else await fetchSlots();
      }
    }
  } catch (e) {
    setAuthHint(e.message, true);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await window.sleepchat.logout();
  setUserInfo(null);
});

modalSubmit.addEventListener("click", async () => {
  const code = modalCode.value.trim();
  if (!code) return;
  modalSubmit.disabled = true;
  try {
    const res = await window.sleepchat.verifyTwoFactor(twoFactorType, code);
    if (!res.ok) return setAuthHint(res.error || "Failed.", true);
    setModalState(false);
    const isAuthenticated = await refreshAuthStatus();
    if (isAuthenticated) {
      const hasCache = await loadCachedSlots();
      if (!hasCache) await fetchAllSlotsSequentially();
      else await fetchSlots();
    }
  } catch (e) {
    setAuthHint(e.message, true);
  } finally {
    modalSubmit.disabled = false;
  }
});

modalToggle.addEventListener("click", () => {
  twoFactorType =
    twoFactorType === "otp"
      ? twoFactorMethods.includes("emailOtp")
        ? "email"
        : "totp"
      : "otp";
  updateModalCopy();
});

// --- Event Listeners: Sleep Mode & System ---

toggleButton.addEventListener("click", async () => {
  const isCurrentlyEnabled = statusBadge.classList.contains("on");
  toggleButton.disabled = true;
  toggleButton.textContent = isCurrentlyEnabled
    ? "Disabling..."
    : "Enabling...";

  try {
    if (isCurrentlyEnabled) {
      await window.sleepchat.stopSleep();
      setStatus(false);
    } else {
      await window.sleepchat.startSleep();
      setStatus(true);
    }
  } catch (e) {
    appendLog(`Error: ${e.message}`);
    const s = await window.sleepchat.getStatus();
    setStatus(s.sleepMode);
  } finally {
    toggleButton.disabled = false;
  }
});

updateButton.addEventListener("click", () => window.sleepchat.downloadUpdate());

window.sleepchat.onLog((msg) => appendLog(msg));
window.sleepchat.onUpdateAvailable(
  () => (updateButton.style.display = "block"),
);

// --- Data Loading Helpers ---

async function loadCachedSlots() {
  try {
    const cached = await window.sleepchat.getCachedMessageSlots();
    if (!cached) return false;
    let hasContent = false;
    Object.keys(cached).forEach((type) => {
      if (Array.isArray(cached[type])) {
        cachedSlotsData[type] = cached[type].map((msg, i) => {
          if (msg) hasContent = true;
          return { slot: i, message: msg };
        });
      }
    });
    updateSlotPreviews();
    return hasContent;
  } catch (e) {
    return false;
  }
}

async function loadSettings() {
  const s = await window.sleepchat.getSettings();
  sleepStatus.value = s.sleepStatus || "none";
  sleepStatus.style.color = STATUS_COLORS[sleepStatus.value] || "#e3e5e8";
  sleepStatusDescription.value = s.sleepStatusDescription || "";
  inviteMessageSlot.value = s.inviteMessageSlot || 0;
  autoStatusEnabled = !!s.autoStatusEnabled;
  inviteMessageEnabled = !!s.inviteMessageEnabled;

  // Migration: Ensure old settings don't stick to non-Invite message types
  if (s.inviteMessageType && s.inviteMessageType !== "message") {
    saveSettings();
  }

  autoStatusToggle.checked = autoStatusEnabled;
  inviteMessageToggle.checked = inviteMessageEnabled;
  if (s.activeTab) setActiveTab(s.activeTab);
  updateSlotPreviews();
}

async function loadCooldowns() {
  const c = await window.sleepchat.getCooldowns();
  if (c) slotCooldowns = c;
}

// --- Initialization ---

(async () => {
  // 1. Instantly check local auth status and show the view
  const isAuthenticated = await refreshAuthStatus();

  // 2. Load disk data in parallel
  const [hasCache] = await Promise.all([
    loadCachedSlots(),
    loadWhitelist(),
    loadSettings(),
    loadCooldowns(),
  ]);

  // 3. Sync Engine state
  window.sleepchat.getStatus().then((s) => setStatus(s.sleepMode));

  // 4. Fetch currently selected slot only
  // Background polling (60s interval) will sync the rest without hammering the API
  if (isAuthenticated) {
    await fetchSlots();
  }
})();
