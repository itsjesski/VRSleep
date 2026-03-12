/**
 * Event listeners and IPC event subscriptions.
 */

function bindTabEvents() {
  tabWhitelist.addEventListener("click", async () => {
    setActiveTab("whitelist");
    if (currentUser) {
      await refreshFriendsCache();
    }
  });

  tabActivity.addEventListener("click", () => setActiveTab("activity"));

  tabCustomizations.addEventListener("click", () => {
    setActiveTab("customizations");
    if (currentUser) fetchSlots();
  });
}

function bindWhitelistEvents() {
  if (
    !manageWhitelistButton ||
    !friendsModal ||
    !friendsSearch ||
    !friendsList ||
    !friendsSave ||
    !friendsManualInput ||
    !friendsManualAdd ||
    !friendsClose
  ) {
    console.warn("Whitelist modal elements were not found; skipping whitelist event binding.");
    return;
  }

  manageWhitelistButton.addEventListener("click", async () => {
    friendsModal.classList.add("active");
    if (allFriends.length > 0) {
      renderFriendsList(allFriends);
    } else {
      renderFriendsListState(getUiText("friendsLoadingState"));
    }

    appendLog(getUiText("friendsLoadingLog"));
    const ok = await refreshFriendsCache();
    if (!ok) {
      allFriends = [];
      renderFriendsList(allFriends);
      appendLog(getUiText("friendsRefreshFailedLog"));
      return;
    }

    const existing = new Set(whitelistEntries.map((e) => e.toLowerCase()));
    selectedFriends.clear();
    allFriends.forEach((f) => {
      const friendId = String(f.id || "").toLowerCase();
      const friendName = String(f.displayName || "").toLowerCase();
      if (existing.has(friendId) || existing.has(friendName)) {
        selectedFriends.add(f.id);
      }
    });

    renderFriendsList(allFriends);
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
      .map((f) => f.displayName || f.id)
      .filter(Boolean);
    const existingLower = whitelistEntries.map((e) => e.toLowerCase());
    const newOnes = selectedNames.filter(
      (n) => !existingLower.includes(n.toLowerCase()),
    );

    if (newOnes.length > 0) {
      whitelistEntries = [...whitelistEntries, ...newOnes];
      renderWhitelistList();
      scheduleAutoSave();
    }
    closeFriendsModal();
    appendLog(
      newOnes.length > 0
        ? formatUiText("friendsAddedLog", { count: newOnes.length })
        : getUiText("friendsAddedNoneLog"),
    );
  });

  friendsManualAdd.addEventListener("click", () => {
    const result = addWhitelistEntry(friendsManualInput.value);
    if (result.added) {
      appendLog(formatUiText("whitelistAddedLog", { entry: result.value }));
      closeFriendsModal();
      return;
    }
    if (result.reason === "duplicate") {
      appendLog(getUiText("whitelistDuplicateLog"));
    }
  });

  friendsManualInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    friendsManualAdd.click();
  });

  friendsClose.addEventListener("click", closeFriendsModal);
}

function bindCustomizationEvents() {
  autoStatusToggle.addEventListener("change", () => {
    autoStatusEnabled = autoStatusToggle.checked;
    scheduleSettingsSave();
  });

  inviteMessageToggle.addEventListener("change", () => {
    inviteMessageEnabled = inviteMessageToggle.checked;
    scheduleSettingsSave();
  });

  sleepStatus.addEventListener("change", () => {
    updateSleepStatusDot();
    scheduleSettingsSave();
  });

  sleepStatusDescription.addEventListener("input", () => {
    const len = sleepStatusDescription.value.length;
    statusCharCount.textContent = `${len}/32`;
    statusCharCount.style.color =
      len >= 32 ? "#f87171" : "var(--color-muted)";
    scheduleSettingsSave();
  });

  inviteMessageSlot.addEventListener("change", () => {
    if (currentUser) {
      fetchSlots();
    }
    updateApplyButtonState();
    scheduleSettingsSave();
  });

  inviteSlotPreview.addEventListener("input", () => {
    const len = inviteSlotPreview.value.length;
    inviteCharCount.textContent = `${len}/64`;
    inviteCharCount.style.color =
      len >= 64 ? "#f87171" : "var(--color-muted)";
    updateApplyButtonState();
  });

  applySlotButton.addEventListener("click", async () => {
    const type = "message";
    const slot = Number(inviteMessageSlot.value);
    const message = inviteSlotPreview.value;

    isApplying = true;
    applySlotButton.disabled = true;
    applySlotButton.textContent = getUiText("applyButtonApplying");

    try {
      const result = await window.sleepchat.updateMessageSlot(
        type,
        slot,
        message,
      );
      if (result?.sessionExpired) {
        await handleSessionExpired(result.error);
        return;
      }
      if (!result.ok) throw new Error(result.error);

      if (Array.isArray(result.result)) {
        cachedSlotsData[type] = result.result;
        const cooldowns = await window.sleepchat.getCooldowns();
        if (cooldowns) slotCooldowns = cooldowns;
        appendLog(formatUiText("updatedSlotLog", { slot: slot + 1 }));
        updateSlotPreviews();
      } else {
        appendLog(getUiText("unexpectedApiResponseLog"));
      }
    } catch (e) {
      appendLog(formatUiText("genericErrorPrefix", { message: e.message }));
    } finally {
      isApplying = false;
      updateApplyButtonState();
    }
  });
}

function bindAuthAndSystemEvents() {
  loginButton.addEventListener("click", async () => {
    setAuthHint("");
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
      return setAuthHint(getUiText("authRequired"), true);
    }

    loginButton.disabled = true;
    try {
      const res = await window.sleepchat.login(username, password);
      if (!res.ok) return setAuthHint(res.error || getUiText("authFailed"), true);

      if (res.result?.status === "2fa") {
        twoFactorMethods = res.result.methods || [];
        twoFactorType = twoFactorMethods.includes("emailOtp")
          ? "email"
          : "totp";
        updateModalCopy();
        setModalState(true);
      } else {
        passwordInput.value = "";
        setSessionExpiredModalState(false);
        const isAuthenticated = await refreshAuthStatus();
        if (isAuthenticated) {
          const hasCache = await loadCachedSlots();
          if (!hasCache) await fetchAllSlotsSequentially();
          else await fetchSlots();
          await refreshFriendsCache();
        }
      }
    } catch (e) {
      setAuthHint(e.message, true);
    } finally {
      loginButton.disabled = false;
    }
  });

  userDisplayName.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("show");
  });

  userDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    userDropdown.classList.remove("show");
  });

  dropdownViewLog.addEventListener("click", async () => {
    userDropdown.classList.remove("show");
    try {
      await window.sleepchat.openLog();
    } catch (error) {
      appendLog(formatUiText("openLogFailed", { message: error.message }));
    }
  });

  dropdownLogout.addEventListener("click", async () => {
    userDropdown.classList.remove("show");
    await forceLogoutToLogin("");
  });

  modalSubmit.addEventListener("click", async () => {
    const code = modalCode.value.trim();
    if (!code) return;
    modalSubmit.disabled = true;
    try {
      const res = await window.sleepchat.verifyTwoFactor(twoFactorType, code);
      if (!res.ok) return setAuthHint(res.error || getUiText("authFailed"), true);
      setModalState(false);
      setSessionExpiredModalState(false);
      const isAuthenticated = await refreshAuthStatus();
      if (isAuthenticated) {
        const hasCache = await loadCachedSlots();
        if (!hasCache) await fetchAllSlotsSequentially();
        else await fetchSlots();
        await refreshFriendsCache();
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

  toggleButton.addEventListener("click", async () => {
    const isCurrentlyEnabled = statusBadge.classList.contains("on");
    toggleButton.disabled = true;
    toggleButton.textContent = isCurrentlyEnabled
      ? getUiText("sleepModeDisabling")
      : getUiText("sleepModeEnabling");

    try {
      if (isCurrentlyEnabled) {
        await window.sleepchat.stopSleep();
        setStatus(false);
      } else {
        await window.sleepchat.startSleep();
        setStatus(true);
      }
    } catch (e) {
      appendLog(formatUiText("genericErrorPrefix", { message: e.message }));
      const s = await window.sleepchat.getStatus();
      setStatus(s.sleepMode);
    } finally {
      toggleButton.disabled = false;
    }
  });

  updateButton.addEventListener("click", () => window.sleepchat.downloadUpdate());
}

function bindSessionModalEvents() {
  if (sessionExpiredOk) {
    sessionExpiredOk.addEventListener("click", async () => {
      await dismissSessionExpiredModal();
    });
  }

  if (sessionExpiredModal) {
    sessionExpiredModal.addEventListener("click", async (event) => {
      if (event.target === sessionExpiredModal) {
        await dismissSessionExpiredModal();
      }
    });
  }

  document.addEventListener("keydown", async (event) => {
    if (
      event.key === "Escape" &&
      sessionExpiredModal &&
      sessionExpiredModal.classList.contains("active")
    ) {
      event.preventDefault();
      await dismissSessionExpiredModal();
    }
  });
}

function bindIpcEvents() {
  window.sleepchat.onLog((msg) => appendLog(msg));
  window.sleepchat.onUpdateAvailable(
    () => (updateButton.style.display = "block"),
  );
  window.sleepchat.onSessionExpired((payload) => {
    handleSessionExpired(payload?.message);
  });
}

function bindRendererEvents() {
  bindTabEvents();
  bindWhitelistEvents();
  bindCustomizationEvents();
  bindAuthAndSystemEvents();
  bindSessionModalEvents();
  bindIpcEvents();
}
