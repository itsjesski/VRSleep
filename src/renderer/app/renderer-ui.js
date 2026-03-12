/**
 * UI helpers and modal/session behavior.
 */

window.onerror = function (message, _source, lineno, colno, error) {
  appendLog(`UI Error: ${message} at ${lineno}:${colno}`);
  console.error(error);
};

function showView(view) {
  loginView.classList.remove("active");
  mainView.classList.remove("active");
  view.classList.add("active");
}

function setStatus(enabled) {
  statusBadge.textContent = enabled
    ? getUiText("statusEnabled")
    : getUiText("statusDisabled");
  statusBadge.className = enabled ? "status on" : "status off";
  toggleButton.textContent = enabled
    ? getUiText("sleepModeDisableButton")
    : getUiText("sleepModeEnableButton");
  toggleButton.className = enabled ? "secondary" : "primary";
}

function appendLog(message) {
  const item = document.createElement("div");
  item.className = "log-item";
  if (typeof message === "string" && message.startsWith("Sent invite to ")) {
    item.classList.add("invite-event");
  }
  const timestamp = new Date().toLocaleTimeString();
  item.textContent = `[${timestamp}] ${message}`;
  logList.prepend(item);
  updateLogEmptyState();
}

function updateLogEmptyState() {
  if (!logEmpty) return;
  const hasEvents = logList && logList.childElementCount > 0;
  logEmpty.classList.toggle("hidden", hasEvents);
}

function normalizeWhitelistEntry(entry) {
  return String(entry || "").trim();
}

function getFriendForWhitelistEntry(entry) {
  const normalized = String(entry || "").trim().toLowerCase();
  if (!normalized || !Array.isArray(allFriends) || allFriends.length === 0) {
    return null;
  }

  return (
    allFriends.find((friend) => {
      const id = String(friend.id || "").toLowerCase();
      const displayName = String(friend.displayName || "").toLowerCase();
      return normalized === id || normalized === displayName;
    }) || null
  );
}

function formatFriendStatus(friend) {
  const rawStatus = String(friend?.status || "").trim().toLowerCase();
  if (rawStatus === "offline") {
    return {
      text: getUiText("friendStatusOffline"),
      isOffline: true,
      color: STATUS_COLORS.none,
    };
  }

  const text =
    String(friend?.statusDescription || "").trim() ||
    String(friend?.status || "").trim() ||
    getUiText("friendStatusOnline");

  const color =
    rawStatus === "join me"
      ? STATUS_COLORS["join me"]
      : rawStatus === "ask me"
        ? STATUS_COLORS["ask me"]
        : rawStatus === "busy"
          ? STATUS_COLORS.busy
          : STATUS_COLORS.active;

  return { text, isOffline: false, color };
}

function renderWhitelistList() {
  if (!whitelistList) return;

  whitelistList.innerHTML = "";

  const deduped = [];
  const seen = new Set();
  for (const entry of whitelistEntries) {
    const cleaned = normalizeWhitelistEntry(entry);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(cleaned);
  }
  whitelistEntries = deduped;

  whitelistEntries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "whitelist-item";

    const main = document.createElement("div");
    main.className = "whitelist-main";

    const name = document.createElement("div");
    name.className = "whitelist-name";
    name.textContent = entry;

    const friend = getFriendForWhitelistEntry(entry);
    const subtext = document.createElement("div");
    subtext.className = "whitelist-subtext";
    if (friend) {
      const statusInfo = formatFriendStatus(friend);
      const dot = document.createElement("span");
      dot.className = "status-dot";
      dot.style.backgroundColor = statusInfo.color;

      const text = document.createElement("span");
      text.textContent = statusInfo.text;

      subtext.appendChild(dot);
      subtext.appendChild(text);
      if (statusInfo.isOffline) {
        subtext.classList.add("offline");
      }
    } else {
      subtext.textContent = getUiText("whitelistNotInFriends");
    }

    const removeButton = document.createElement("button");
    removeButton.className = "whitelist-remove";
    removeButton.textContent = "✕";
    removeButton.title = `Remove ${entry}`;
    removeButton.addEventListener("click", () => {
      whitelistEntries.splice(index, 1);
      renderWhitelistList();
      scheduleAutoSave();
      appendLog(formatUiText("whitelistRemovedLog", { entry }));
    });

    main.appendChild(name);
    main.appendChild(subtext);
    row.appendChild(main);
    row.appendChild(removeButton);
    whitelistList.appendChild(row);
  });

  if (whitelistEmpty) {
    whitelistEmpty.classList.toggle("hidden", whitelistEntries.length > 0);
  }
}

function setWhitelistStatus(text, state = "error") {
  if (state === "error" && text) {
    whitelistStatus.textContent = text;
    whitelistStatus.style.display = "block";
  } else {
    whitelistStatus.style.display = "none";
    whitelistStatus.textContent = "";
  }
}

function setAuthHint(message, isError = false) {
  authHint.textContent = message || "";
  authHint.style.color = isError ? "#f87171" : "#9ca3af";
}

function setUserInfo(user) {
  currentUser = user;
  if (user) {
    userDisplayName.textContent =
      user.displayName || user.username || getUiText("currentUserFallback");
    userHeader.style.display = "flex";
    showView(mainView);
  } else {
    userHeader.style.display = "none";
    showView(loginView);
  }
}

function setModalState(visible) {
  if (visible) modal.classList.add("active");
  else modal.classList.remove("active");
}

function setSessionExpiredModalState(
  visible,
  message = getSessionExpiredMessage(),
) {
  if (!sessionExpiredModal) return;
  if (sessionExpiredTitle) {
    sessionExpiredTitle.textContent = getSessionExpiredTitle();
  }
  if (sessionExpiredMessage) {
    sessionExpiredMessage.textContent = String(message || getSessionExpiredMessage());
  }
  if (visible) sessionExpiredModal.classList.add("active");
  else sessionExpiredModal.classList.remove("active");
}

function updateModalCopy() {
  if (twoFactorType === "email") {
    modalTitle.textContent = getUiText("twoFactorEmailTitle");
    modalHint.textContent = getUiText("twoFactorEmailHint");
    modalToggle.textContent = getUiText("twoFactorUseBackupCode");
  } else if (twoFactorType === "otp") {
    modalTitle.textContent = getUiText("twoFactorBackupTitle");
    modalHint.textContent = getUiText("twoFactorBackupHint");
    modalToggle.textContent = twoFactorMethods.includes("emailOtp")
      ? getUiText("twoFactorUseEmailCode")
      : getUiText("twoFactorUseAuthenticator");
  } else {
    modalTitle.textContent = getUiText("twoFactorAuthenticatorTitle");
    modalHint.textContent = getUiText("twoFactorAuthenticatorHint");
    modalToggle.textContent = getUiText("twoFactorUseBackupCode");
  }
}

function updateSleepStatusDot() {
  if (sleepStatusDot) {
    sleepStatusDot.style.backgroundColor =
      STATUS_COLORS[sleepStatus.value] || "var(--color-muted)";
  }
}

async function forceLogoutToLogin(
  hintMessage = getSessionExpiredMessage(),
) {
  try {
    await window.sleepchat.logout();
  } catch (_error) {
  }

  setModalState(false);
  if (friendsModal?.classList.contains("active")) {
    closeFriendsModal();
  }
  userDropdown?.classList.remove("show");
  setSessionExpiredModalState(false);
  setUserInfo(null);
  setAuthHint(hintMessage, true);
  if (usernameInput) usernameInput.focus();
}

async function dismissSessionExpiredModal() {
  await forceLogoutToLogin(getSessionExpiredMessage());
}

async function handleSessionExpired(
  message = getSessionExpiredMessage(),
) {
  if (handlingSessionExpiration) return;
  handlingSessionExpiration = true;

  appendLog(getSessionExpiredLogText());

  setModalState(false);
  if (friendsModal?.classList.contains("active")) {
    closeFriendsModal();
  }
  userDropdown?.classList.remove("show");
  setSessionExpiredModalState(true, String(message || ""));

  handlingSessionExpiration = false;
}
