/**
 * Data synchronization, settings, whitelist, and friends logic.
 */

async function refreshAuthStatus() {
  try {
    const status = await window.sleepchat.getAuthStatus();
    if (status.authenticated) {
      if (status.user) {
        setUserInfo(status.user);
      } else {
        setUserInfo({
          id: status.userId,
          displayName: getUiText("loadingUserDisplayName"),
        });
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

async function loadWhitelist() {
  const list = await window.sleepchat.getWhitelist();
  whitelistEntries = Array.isArray(list)
    ? list.map(normalizeWhitelistEntry).filter(Boolean)
    : [];
  renderWhitelistList();
  setWhitelistStatus("");
}

async function saveWhitelist() {
  renderWhitelistList();
  const list = [...whitelistEntries];
  try {
    await window.sleepchat.setWhitelist(list);
    setWhitelistStatus("");
    appendLog(
      list.length > 0
        ? formatUiText("whitelistSummaryLog", { items: list.join(", ") })
        : getUiText("whitelistClearedLog"),
    );
  } catch (_err) {
    setWhitelistStatus(getUiText("whitelistSaveFailed"), "error");
  }
}

function scheduleAutoSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveWhitelist();
  }, 1000);
}

function closeFriendsModal() {
  friendsModal.classList.remove("active");
  if (friendsSearch) friendsSearch.value = "";
  if (friendsManualInput) friendsManualInput.value = "";
}

function addWhitelistEntry(entry) {
  const cleaned = normalizeWhitelistEntry(entry);
  if (!cleaned) return { added: false, reason: "empty" };

  const exists = whitelistEntries.some(
    (item) => item.toLowerCase() === cleaned.toLowerCase(),
  );
  if (exists) return { added: false, reason: "duplicate" };

  whitelistEntries.push(cleaned);
  renderWhitelistList();
  scheduleAutoSave();
  return { added: true, value: cleaned };
}

async function refreshFriendsCache(force = false) {
  const CACHE_TTL = 60000;
  if (!force && allFriends.length > 0 && Date.now() - friendsCacheTime < CACHE_TTL) {
    renderWhitelistList();
    if (friendsModal.classList.contains("active")) {
      renderFriendsList(allFriends);
    }
    return true;
  }

  try {
    const result = await window.sleepchat.getFriends();
    if (result?.sessionExpired) {
      await handleSessionExpired(result.error);
      return false;
    }
    if (!result.ok || !Array.isArray(result.friends)) return false;
    allFriends = result.friends;
    friendsCacheTime = Date.now();
    renderWhitelistList();
    if (friendsModal.classList.contains("active")) {
      renderFriendsList(allFriends);
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function startFriendStatusPolling() {
  setInterval(async () => {
    if (!currentUser) return;
    await refreshFriendsCache();
  }, 60000);
}

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

function scheduleSettingsSave() {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(saveSettings, 2000);
}

function renderFriendsListState(message) {
  if (!friendsList) return;

  friendsList.replaceChildren();

  const state = document.createElement("div");
  state.style.padding = "20px";
  state.style.textAlign = "center";
  state.style.color = "var(--color-muted)";
  state.textContent = String(message || "");

  friendsList.appendChild(state);
}

function renderFriendsList(friends) {
  friendsList.replaceChildren();
  if (friends.length === 0) {
    renderFriendsListState(getUiText("friendsEmptyState"));
    return;
  }

  friends.forEach((friend) => {
    const item = document.createElement("div");
    item.className = `friend-item ${selectedFriends.has(friend.id) ? "selected" : ""}`;

    const info = document.createElement("div");
    info.className = "friend-info";
    const name = document.createElement("div");
    name.className = "friend-name";
    name.textContent = friend.displayName;

    const status = document.createElement("div");
    status.className = "friend-status";
    const statusInfo = formatFriendStatus(friend);
    const dot = document.createElement("span");
    dot.className = "status-dot";
    dot.style.backgroundColor = statusInfo.color;

    const text = document.createElement("span");
    text.textContent = statusInfo.text;

    status.appendChild(dot);
    status.appendChild(text);
    if (statusInfo.isOffline) {
      status.classList.add("offline");
    }

    info.appendChild(name);
    info.appendChild(status);

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
