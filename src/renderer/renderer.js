window.onerror = function (message, source, lineno, colno, error) {
  appendLog(`UI Error: ${message} at ${lineno}:${colno}`);
  console.error(error);
};

const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const userHeader = document.getElementById("user-header");
const whitelistInput = document.getElementById("whitelist");
const toggleButton = document.getElementById("toggle");
const statusBadge = document.getElementById("status");
const logList = document.getElementById("log");
const userDisplayName = document.getElementById("user-display-name");
const authHint = document.getElementById("auth-hint");
const whitelistStatus = document.getElementById("whitelist-status");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login");
const logoutButton = document.getElementById("logout");
const updateButton = document.getElementById("update-btn");
const manageWhitelistButton = document.getElementById("manage-whitelist");
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

const autoStatusToggle = document.getElementById("auto-status-toggle");
const sleepStatus = document.getElementById("sleep-status");
const sleepStatusDescription = document.getElementById(
  "sleep-status-description",
);

const inviteMessageSlot = document.getElementById("invite-message-slot");
const inviteSlotPreview = document.getElementById("invite-slot-preview");
const inviteMessageToggle = document.getElementById("invite-message-toggle");
const inviteMessageType = document.getElementById("invite-message-type");
const statusCharCount = document.getElementById("status-char-count");
const inviteCharCount = document.getElementById("invite-char-count");
const applySlotButton = document.getElementById("apply-slot");

let twoFactorType = "totp";
let twoFactorMethods = [];
let currentUser = null;
let whitelistDirty = false;
let saveTimer = null;
let settingsTimer = null;
let allFriends = [];
let selectedFriends = new Set();

function showView(view) {
  loginView.classList.remove("active");
  mainView.classList.remove("active");
  view.classList.add("active");
}

function setStatus(enabled) {
  statusBadge.textContent = enabled ? "Enabled" : "Disabled";
  statusBadge.className = enabled ? "status on" : "status off";
  toggleButton.textContent = enabled
    ? "Disable Sleep Mode"
    : "Enable Sleep Mode";
  toggleButton.className = enabled ? "secondary" : "primary";
}

function appendLog(message) {
  const item = document.createElement("div");
  item.className = "log-item";
  const timestamp = new Date().toLocaleTimeString();
  item.textContent = `[${timestamp}] ${message}`;
  logList.prepend(item);
}

function setWhitelistStatus(text, state = "saved") {
  whitelistStatus.textContent = text;
  whitelistStatus.className = `status ${state}`;
}

function setAuthHint(message, isError = false) {
  authHint.textContent = message || "";
  authHint.style.color = isError ? "#f87171" : "#9ca3af";
}

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

function setModalState(visible) {
  if (visible) {
    modal.classList.add("active");
  } else {
    modal.classList.remove("active");
  }
}

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

async function refreshAuthStatus() {
  try {
    const status = await window.sleepchat.getAuthStatus();
    if (status.authenticated) {
      if (status.user) {
        setUserInfo(status.user);
      } else {
        setUserInfo({ id: status.userId, displayName: "Loading..." });
        // Fetch full user data in background if only ID is known
        window.sleepchat.getCurrentUser().then((userResult) => {
          if (userResult.ok && userResult.user) setUserInfo(userResult.user);
        });
      }
      return true;
    } else {
      setUserInfo(null);
      return false;
    }
  } catch (error) {
    console.error("Failed to refresh status:", error);
    setUserInfo(null);
    return false;
  }
}

async function loadWhitelist() {
  const list = await window.sleepchat.getWhitelist();
  whitelistInput.value = list.join("\n");
  whitelistDirty = false;
  setWhitelistStatus("Saved");
  if (list.length > 0) {
    appendLog(`Whitelist: ${list.join(", ")}`);
  }
}

function parseWhitelist(text) {
  return text
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function saveWhitelist() {
  const list = parseWhitelist(whitelistInput.value);
  await window.sleepchat.setWhitelist(list);
  whitelistDirty = false;
  setWhitelistStatus("Saved", "saved");
  if (list.length > 0) {
    appendLog(`Whitelist: ${list.join(", ")}`);
  } else {
    appendLog("Whitelist cleared.");
  }
}

function scheduleAutoSave() {
  whitelistDirty = true;
  setWhitelistStatus("Unsaved", "unsaved");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    setWhitelistStatus("Saving...", "saving");
    await saveWhitelist();
  }, 1000);
}

whitelistInput.addEventListener("input", () => {
  scheduleAutoSave();
});

tabWhitelist.addEventListener("click", () => {
  setActiveTab("whitelist");
});

tabCustomizations.addEventListener("click", () => {
  setActiveTab("customizations");
  if (currentUser) {
    fetchSlots().then(() => {
      updateApplyButtonState();
    });
  }
});

tabActivity.addEventListener("click", () => {
  setActiveTab("activity");
});

function setActiveTab(tabName) {
  // Update UI
  tabWhitelist.classList.toggle("active", tabName === "whitelist");
  tabCustomizations.classList.toggle("active", tabName === "customizations");
  tabActivity.classList.toggle("active", tabName === "activity");

  contentWhitelist.classList.toggle("active", tabName === "whitelist");
  contentCustomizations.classList.toggle(
    "active",
    tabName === "customizations",
  );
  contentActivity.classList.toggle("active", tabName === "activity");

  // Save to settings
  scheduleSettingsSave();
}

const STATUS_COLORS = {
  none: "#9ca3af",
  "join me": "#42CAFF",
  active: "#51E57E",
  "ask me": "#E8B138",
  busy: "#C93131",
};

let autoStatusEnabled = false;
let inviteMessageEnabled = false;

function updateAutoStatusUI() {
  autoStatusToggle.checked = autoStatusEnabled;
  inviteMessageToggle.checked = inviteMessageEnabled;
  sleepStatusDescription.maxLength = 32;

  const len = sleepStatusDescription.value.length;
  statusCharCount.textContent = `${len}/32`;
  statusCharCount.style.color = len >= 32 ? "#f87171" : "var(--color-muted)";

  // Update dropdown text color to match selected status
  sleepStatus.style.color = STATUS_COLORS[sleepStatus.value] || "#e3e5e8";
}

let lastSavedSettings = null;

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
    inviteMessageType: inviteMessageType.value || "message",
    autoStatusEnabled,
    inviteMessageEnabled,
    activeTab,
  };

  // Only save and trigger updates if settings have actually changed
  const settingsString = JSON.stringify(settings);
  if (lastSavedSettings === settingsString) return;
  lastSavedSettings = settingsString;

  await window.sleepchat.setSettings(settings);
}

function scheduleSettingsSave() {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(async () => {
    await saveSettings();
  }, 2000); // Increased to 2 seconds to be safer
}

autoStatusToggle.addEventListener("change", () => {
  autoStatusEnabled = autoStatusToggle.checked;
  updateAutoStatusUI();
  scheduleSettingsSave();
});

inviteMessageToggle.addEventListener("change", () => {
  inviteMessageEnabled = inviteMessageToggle.checked;
  updateAutoStatusUI();
  scheduleSettingsSave();
});

sleepStatus.addEventListener("change", () => {
  updateAutoStatusUI();
  scheduleSettingsSave();
});

sleepStatusDescription.addEventListener("input", () => {
  updateAutoStatusUI();
  scheduleSettingsSave();
});

inviteMessageType.addEventListener("change", () => {
  fetchSlots();
  scheduleSettingsSave();
});

inviteMessageSlot.addEventListener("change", async () => {
  fetchSlots();
  scheduleSettingsSave();
});

inviteSlotPreview.addEventListener("input", () => {
  const len = inviteSlotPreview.value.length;
  inviteCharCount.textContent = `${len}/64`;
  inviteCharCount.style.color = len >= 64 ? "#f87171" : "var(--color-muted)";

  // Instantly update button state (duplicate check)
  updateApplyButtonState();
});

let slotCooldowns = {
  message: {},
  response: {},
  request: {},
  requestResponse: {},
};

async function setCooldown(type, slot, errorMessage) {
  if (!errorMessage) return false;
  const match = errorMessage.match(/wait (\d+) more minute/i);
  if (match) {
    const mins = parseInt(match[1], 10);
    if (!slotCooldowns[type]) slotCooldowns[type] = {};
    const unlockTimestamp = Date.now() + mins * 60 * 1000;
    slotCooldowns[type][slot] = unlockTimestamp;

    // Persist to store
    await window.sleepchat.setCooldown(type, slot, unlockTimestamp);
    return true;
  }
  return false;
}

function updateApplyButtonState() {
  const type = inviteMessageType.value;
  const slot = Number(inviteMessageSlot.value);

  // Don't interrupt "Applying...", "Checking...", or "Loading..." states
  if (
    ["Applying...", "Checking...", "Loading..."].includes(
      applySlotButton.textContent,
    )
  )
    return;

  const unlockTime =
    slotCooldowns[type] && typeof slotCooldowns[type][slot] === "number"
      ? slotCooldowns[type][slot]
      : 0;

  const now = Date.now();
  const currentSlotData = cachedSlotsData[type]
    ? cachedSlotsData[type][slot]
    : null;
  const currentVrcMessage = currentSlotData
    ? typeof currentSlotData.message === "string"
      ? currentSlotData.message
      : ""
    : null; // Use null to indicate data is missing/loading

  // If we don't have the message yet (null), or it matches, it stays disabled
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
    applySlotButton.classList.remove("countdown-mode");
    applySlotButton.classList.remove("primary");
    applySlotButton.classList.add("secondary");
  } else {
    applySlotButton.disabled = false;
    applySlotButton.textContent = "Apply";
    applySlotButton.classList.remove("countdown-mode");
    applySlotButton.classList.remove("secondary");
    applySlotButton.classList.add("primary");
  }
}

// Update the countdown timer every second for smooth UI
setInterval(updateApplyButtonState, 1000);

let isApplying = false;

// Background poll every 60 seconds
setInterval(async () => {
  if (currentUser && !isApplying) {
    const type = inviteMessageType.value;
    console.log(`Background polling ${type} slots...`);

    try {
      const result = await window.sleepchat.getMessageSlots(type);
      if (result.ok && Array.isArray(result.messages)) {
        cachedSlotsData[type] = result.messages;

        // Refresh cooldowns from store
        const cooldowns = await window.sleepchat.getCooldowns();
        if (cooldowns) slotCooldowns = cooldowns;

        updateSlotPreviews();
      }
    } catch (error) {
      console.error(`Poll failed for ${type}:`, error);
    }
  }
}, 60000);

applySlotButton.addEventListener("click", async () => {
  const type = inviteMessageType.value;
  const slot = Number(inviteMessageSlot.value);
  const message = inviteSlotPreview.value;

  // Immediate UI feedback
  isApplying = true;
  applySlotButton.disabled = true;
  applySlotButton.textContent = "Applying...";
  applySlotButton.classList.add("countdown-mode");
  applySlotButton.classList.remove("primary");

  try {
    const result = await window.sleepchat.updateMessageSlot(
      type,
      slot,
      message,
    );

    if (!result.ok) {
      throw new Error(result.error);
    }

    // result.result is an array of all 12 slots for this type
    const slots = result.result;
    if (Array.isArray(slots)) {
      if (!cachedSlotsData[type]) cachedSlotsData[type] = [];

      slots.forEach((s) => {
        // Update both message and slot mapping
        cachedSlotsData[type][s.slot] = { slot: s.slot, message: s.message };
      });

      // Refresh cooldowns from store to get newest unlockTime (handled by IPC in main)
      const cooldowns = await window.sleepchat.getCooldowns();
      if (cooldowns) slotCooldowns = cooldowns;

      appendLog(`Updated ${type} Slot ${slot + 1}.`);
      updateSlotPreviews();
    }
  } catch (error) {
    appendLog(`Failed to update slot: ${error.message}`);
  } finally {
    isApplying = false;
    updateApplyButtonState();
  }
});
loginButton.addEventListener("click", async () => {
  setAuthHint("");
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    setAuthHint("Username and password required.", true);
    return;
  }

  loginButton.disabled = true;
  try {
    const result = await window.sleepchat.login(username, password);
    if (!result.ok) {
      setAuthHint(result.error || "Login failed.", true);
      return;
    }

    if (result.result?.status === "2fa") {
      twoFactorMethods = result.result.methods || [];
      twoFactorType = twoFactorMethods.includes("emailOtp") ? "email" : "totp";
      updateModalCopy();
      modalCode.value = "";
      setModalState(true);
      setAuthHint("Two-factor required.");
    } else {
      passwordInput.value = "";
      if (result.result?.user) {
        setUserInfo(result.result.user);
        const hasCachedContent = await loadCachedSlots();
        if (!hasCachedContent) {
          await fetchAllSlotsSequentially();
        } else {
          await fetchSlots();
        }
      } else {
        await refreshAuthStatus();
        if (currentUser) {
          const hasCachedContent = await loadCachedSlots();
          if (!hasCachedContent) {
            await fetchAllSlotsSequentially();
          } else {
            await fetchSlots();
          }
        }
      }
      setAuthHint("");
    }
  } catch (error) {
    setAuthHint(error.message, true);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await window.sleepchat.logout();
  setAuthHint("");
  setUserInfo(null);
  usernameInput.value = "";
  passwordInput.value = "";
});

modalToggle.addEventListener("click", () => {
  if (twoFactorType === "otp") {
    twoFactorType = twoFactorMethods.includes("emailOtp") ? "email" : "totp";
  } else {
    twoFactorType = "otp";
  }
  updateModalCopy();
});

modalSubmit.addEventListener("click", async () => {
  const code = modalCode.value.trim();
  if (!code) return;
  modalSubmit.disabled = true;
  try {
    const result = await window.sleepchat.verifyTwoFactor(twoFactorType, code);
    if (!result.ok) {
      setAuthHint(result.error || "Verification failed.", true);
      return;
    }
    setModalState(false);
    modalCode.value = "";
    passwordInput.value = "";
    if (result.user) {
      setUserInfo(result.user);
      const hasCachedContent = await loadCachedSlots();
      if (!hasCachedContent) {
        await fetchAllSlotsSequentially();
      } else {
        await fetchSlots();
      }
    } else {
      await refreshAuthStatus();
      if (currentUser) {
        const hasCachedContent = await loadCachedSlots();
        if (!hasCachedContent) {
          await fetchAllSlotsSequentially();
        } else {
          await fetchSlots();
        }
      }
    }
    setAuthHint("");
  } catch (error) {
    setAuthHint(error.message, true);
  } finally {
    modalSubmit.disabled = false;
  }
});

toggleButton.addEventListener("click", async () => {
  const isCurrentlyEnabled = statusBadge.classList.contains("on");

  // Immediate UI feedback
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
  } catch (error) {
    appendLog(`Failed to toggle sleep mode: ${error.message}`);
    // Revert to actual state
    const status = await window.sleepchat.getStatus();
    setStatus(status.sleepMode);
  } finally {
    toggleButton.disabled = false;
  }
});

updateButton.addEventListener("click", async () => {
  await window.sleepchat.downloadUpdate();
});

manageWhitelistButton.addEventListener("click", async () => {
  appendLog("Loading friends list...");
  const result = await window.sleepchat.getFriends();

  if (!result.ok) {
    appendLog(`Failed to load friends: ${result.error}`);
    return;
  }

  allFriends = result.friends;

  // Parse current whitelist to pre-select friends
  const currentWhitelist = whitelistInput.value
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  selectedFriends.clear();
  allFriends.forEach((friend) => {
    const idMatch = currentWhitelist.includes(friend.id.toLowerCase());
    const nameMatch = currentWhitelist.includes(
      friend.displayName.toLowerCase(),
    );
    if (idMatch || nameMatch) {
      selectedFriends.add(friend.id);
    }
  });

  renderFriendsList(allFriends);
  friendsModal.classList.add("active");
});

friendsSearch.addEventListener("input", () => {
  const query = friendsSearch.value.toLowerCase();
  const filtered = allFriends.filter(
    (friend) =>
      friend.displayName.toLowerCase().includes(query) ||
      friend.id.toLowerCase().includes(query),
  );
  renderFriendsList(filtered);
});

friendsClose.addEventListener("click", () => {
  friendsModal.classList.remove("active");
  friendsSearch.value = "";
});

friendsSave.addEventListener("click", () => {
  // Build list from selected friends (use display names)
  const selectedNames = allFriends
    .filter((f) => selectedFriends.has(f.id))
    .map((f) => f.displayName);

  // Get existing whitelist entries
  const existingEntries = whitelistInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Combine existing and new entries, removing duplicates (case-insensitive)
  const existingLower = existingEntries.map((e) => e.toLowerCase());
  const newEntries = selectedNames.filter(
    (name) => !existingLower.includes(name.toLowerCase()),
  );

  // Append new entries to the end
  const combined = [...existingEntries, ...newEntries];

  whitelistInput.value = combined.join("\n");
  setWhitelistStatus("Saving...", "saving");
  scheduleAutoSave();

  friendsModal.classList.remove("active");
  friendsSearch.value = "";

  if (newEntries.length > 0) {
    appendLog(`Added ${newEntries.length} new friend(s) to whitelist`);
  } else {
    appendLog("All selected friends already in whitelist");
  }
});

function renderFriendsList(friends) {
  friendsList.innerHTML = "";

  if (friends.length === 0) {
    friendsList.innerHTML =
      '<div style="padding: 20px; text-align: center; color: var(--color-muted);">No friends found</div>';
    return;
  }

  friends.forEach((friend) => {
    const item = document.createElement("div");
    item.className = "friend-item";
    if (selectedFriends.has(friend.id)) {
      item.classList.add("selected");
    }

    const avatar = document.createElement("img");
    avatar.className = "friend-avatar";
    avatar.src = friend.thumbnailUrl || "";
    avatar.onerror = () => {
      avatar.style.display = "none";
    };

    const info = document.createElement("div");
    info.className = "friend-info";

    const name = document.createElement("div");
    name.className = "friend-name";
    name.textContent = friend.displayName;

    const status = document.createElement("div");
    status.className = "friend-status";
    status.textContent = friend.statusDescription || friend.status;

    info.appendChild(name);
    info.appendChild(status);

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

window.sleepchat.onLog((message) => appendLog(message));

window.sleepchat.onUpdateAvailable(() => {
  updateButton.style.display = "block";
});

async function loadSettings() {
  const settings = await window.sleepchat.getSettings();

  // Clean up corrupted settings if they contain objects
  let settingsChanged = false;
  if (typeof settings.sleepStatus !== "string") {
    settings.sleepStatus = "none";
    settingsChanged = true;
  }
  if (typeof settings.sleepStatusDescription !== "string") {
    settings.sleepStatusDescription = "";
    settingsChanged = true;
  }

  // Save cleaned settings if corruption was found
  if (settingsChanged) {
    await window.sleepchat.setSettings(settings);
  }

  sleepStatus.value =
    typeof settings.sleepStatus === "string" ? settings.sleepStatus : "none";
  sleepStatusDescription.value =
    typeof settings.sleepStatusDescription === "string"
      ? settings.sleepStatusDescription
      : "";
  inviteMessageSlot.value =
    typeof settings.inviteMessageSlot === "number"
      ? settings.inviteMessageSlot
      : 0;
  inviteMessageType.value =
    typeof settings.inviteMessageType === "string"
      ? settings.inviteMessageType
      : "message";
  autoStatusEnabled = !!settings.autoStatusEnabled;
  inviteMessageEnabled = !!settings.inviteMessageEnabled;
  updateAutoStatusUI();

  if (settings.activeTab) {
    setActiveTab(settings.activeTab);
  }
}

let cachedSlotsData = {
  message: [],
  response: [],
  request: [],
  requestResponse: [],
};

async function fetchAllSlotsSequentially() {
  console.log("Populating all message slots...");
  const types = ["message", "response", "request", "requestResponse"];

  for (const type of types) {
    try {
      const result = await window.sleepchat.getMessageSlots(type);
      if (result.ok && Array.isArray(result.messages)) {
        cachedSlotsData[type] = result.messages;
      }
      // Small pause between types to be safe
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Failed to populate ${type} slots:`, error);
    }
  }
  updateSlotPreviews();
}

async function fetchSlots() {
  const type = inviteMessageType.value;
  const slot = Number(inviteMessageSlot.value);

  console.log(`Fetching latest for slot: type=${type}, slot=${slot}`);

  try {
    const result = await window.sleepchat.getMessageSlot(type, slot);

    if (result.ok) {
      const data = result.slotData;

      const message = typeof data === "string" ? data : data?.message || "";

      if (!cachedSlotsData[type])
        cachedSlotsData[type] = Array(12)
          .fill("")
          .map((_, i) => ({ slot: i, message: "" }));

      cachedSlotsData[type][slot] = { slot, message: message };

      // Refresh cooldowns from store to get newest unlockTime (handled by IPC in main)
      const cooldowns = await window.sleepchat.getCooldowns();
      if (cooldowns) slotCooldowns = cooldowns;

      updateSlotPreviews();
    } else if (result.error) {
      console.error("Slot fetch error:", result.error);
    }
  } catch (error) {
    console.error("Failed to fetch slot:", error);
  } finally {
    updateApplyButtonState();
  }
}

function updateSlotPreviews() {
  const type = inviteMessageType.value;
  const inviteIdx = Number(inviteMessageSlot.value);

  if (cachedSlotsData[type] && cachedSlotsData[type][inviteIdx]) {
    const slotData = cachedSlotsData[type][inviteIdx];
    inviteSlotPreview.value =
      typeof slotData.message === "string" ? slotData.message : "";
  } else {
    inviteSlotPreview.value = "";
  }

  // Update character count
  const len = inviteSlotPreview.value.length;
  inviteCharCount.textContent = `${len}/64`;
  inviteCharCount.style.color = len >= 64 ? "#f87171" : "var(--color-muted)";

  // Update button state (cooldown or apply)
  updateApplyButtonState();
}

async function loadCooldowns() {
  try {
    const cooldowns = await window.sleepchat.getCooldowns();
    if (cooldowns) {
      slotCooldowns = cooldowns;
    }
  } catch (error) {
    console.error("Failed to load cooldowns:", error);
  }
}

async function loadCachedSlots() {
  try {
    const cached = await window.sleepchat.getCachedMessageSlots();
    if (cached) {
      // The cache stores just strings, but the UI expects { slot, message }
      let hasContent = false;
      Object.keys(cached).forEach((type) => {
        if (Array.isArray(cached[type])) {
          cachedSlotsData[type] = cached[type].map((msg, i) => {
            if (msg) hasContent = true;
            return {
              slot: i,
              message: msg,
            };
          });
        }
      });
      updateSlotPreviews();
      return hasContent;
    }
  } catch (error) {
    console.error("Failed to load cached slots:", error);
  }
  return false;
}

(async () => {
  // 1. Instantly check local auth status and show the view
  const isAuthenticated = await refreshAuthStatus();

  // 2. Load settings/whitelist/cache from local disk in parallel
  const [hasCachedContent] = await Promise.all([
    loadCachedSlots(),
    loadWhitelist(),
    loadSettings(),
    loadCooldowns(),
  ]);

  // 3. Sync Sleep Mode status from main process
  window.sleepchat.getStatus().then((status) => {
    setStatus(status.sleepMode);
  });

  // 4. Verification/Refresh in the background if logged in
  if (isAuthenticated) {
    // Refresh slots if needed
    if (!hasCachedContent) {
      await fetchAllSlotsSequentially();
    } else {
      await fetchSlots();
    }
  }
})();
