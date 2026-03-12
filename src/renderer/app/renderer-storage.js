/**
 * Cached data/settings loaders.
 */

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
  } catch (_e) {
    return false;
  }
}

async function loadSettings() {
  const s = await window.sleepchat.getSettings();
  const storedStatus = s.sleepStatus || "none";
  sleepStatus.value = storedStatus;
  updateSleepStatusDot();
  sleepStatusDescription.value = s.sleepStatusDescription || "";
  inviteMessageSlot.value = s.inviteMessageSlot || 0;
  autoStatusEnabled = !!s.autoStatusEnabled;
  inviteMessageEnabled = !!s.inviteMessageEnabled;

  if (s.inviteMessageType && s.inviteMessageType !== "message") {
    saveSettings();
  }

  autoStatusToggle.checked = autoStatusEnabled;
  inviteMessageToggle.checked = inviteMessageEnabled;
  setActiveTab(s.activeTab || "whitelist");
  updateSlotPreviews();
}

async function loadCooldowns() {
  const c = await window.sleepchat.getCooldowns();
  if (c) slotCooldowns = c;
}

async function loadUiText() {
  try {
    const next = await window.sleepchat.getUiText();
    if (next && typeof next === "object") {
      uiText = { ...uiText, ...next };
    }
  } catch (_error) {
  }

  if (sessionExpiredTitle) {
    sessionExpiredTitle.textContent = getSessionExpiredTitle();
  }
  if (sessionExpiredMessage) {
    sessionExpiredMessage.textContent = getSessionExpiredMessage();
  }
}
