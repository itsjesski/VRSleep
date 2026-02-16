/**
 * Sleep Mode Engine.
 * Manages background polling for invite requests, automatic responses,
 * and status synchronization with VRChat.
 */
function createSleepMode({
  getWhitelist,
  fetchInvites,
  sendInvite,
  deleteNotification,
  isReadyForApi,
  getCurrentUser,
  updateStatus,
  getMessageSlots,
  getSettings,
  log,
  pollIntervalMs,
  minPollMs,
}) {
  let sleepMode = false;
  let pollTimer = null;
  let preSleepStatus = null;
  let setSleepStatus = null;
  let setSleepDescription = null;

  // Track handled IDs to prevent spam and duplicate invites
  const handledInviteIds = new Set();
  const handledSenderIds = new Set();

  /**
   * Calculates the safe polling interval based on configuration.
   */
  function getPollInterval() {
    const raw = Number(pollIntervalMs);
    if (!Number.isFinite(raw)) return minPollMs;
    return Math.max(raw, minPollMs);
  }

  /**
   * Normalizes strings for consistent whitelist comparison.
   */
  function normalizeEntry(entry) {
    return String(entry || "")
      .trim()
      .toLowerCase();
  }

  /**
   * Core Logic: Checks for new notifications and responds to whitelisted users.
   */
  async function checkInvites() {
    if (!sleepMode || !isReadyForApi()) return;

    let invites;
    try {
      invites = await fetchInvites();
    } catch (error) {
      // API might be temporarily unavailable; fail silently to retry on next poll
      return;
    }

    if (!Array.isArray(invites) || invites.length === 0) return;

    const whitelist = getWhitelist().map(normalizeEntry).filter(Boolean);

    for (const invite of invites) {
      if (!invite) continue;

      const inviteId = invite.id || invite.notificationId || invite._id;
      const senderIdRaw =
        invite.senderId || invite.senderUserId || invite.userId;
      const senderIdNorm = normalizeEntry(senderIdRaw);
      const senderName = normalizeEntry(
        invite.senderDisplayName || invite.senderUsername || invite.displayName,
      );
      const displayName =
        invite.senderDisplayName || invite.senderUsername || senderIdRaw;

      // Rule 1: Skip if we've already invited this sender in this session.
      // We still delete the notification to keep the user's feed clean.
      if (handledSenderIds.has(senderIdRaw)) {
        if (inviteId) await deleteNotification(inviteId).catch(() => { });
        continue;
      }

      // Rule 2: Skip if we've already handled this specific notification ID.
      if (inviteId && handledInviteIds.has(inviteId)) {
        continue;
      }

      // Rule 3: Only respond if the sender is in the whitelist.
      const matches =
        whitelist.includes(senderIdNorm) || whitelist.includes(senderName);
      if (!matches) {
        // If not whitelisted, we still hide the notification so it doesn't
        // clutter the feed or trigger future checks.
        if (inviteId) await deleteNotification(inviteId).catch(() => { });
        continue;
      }

      // Action: Send the invite
      try {
        const settings = getSettings();
        const isInviteMessageEnabled = !!settings.inviteMessageEnabled;
        const messageSlot =
          isInviteMessageEnabled && settings.inviteMessageSlot !== undefined
            ? settings.inviteMessageSlot
            : null;
        const messageType = "message";

        await sendInvite(senderIdRaw, "", messageSlot, messageType);

        handledSenderIds.add(senderIdRaw);
        if (inviteId) handledInviteIds.add(inviteId);
        log(`Sent invite to ${displayName}`);

        // Cleanup the notification after successful response
        if (inviteId) await deleteNotification(inviteId).catch(() => { });
      } catch (error) {
        log(`Failed to send invite to ${displayName}: ${error.message}`);
        // Hide it anyway so we don't get stuck in an error loop on the same notification
        if (inviteId) await deleteNotification(inviteId).catch(() => { });
      }
    }
  }

  /**
   * Starts the polling timer.
   */
  function startPolling() {
    if (pollTimer) return;
    const interval = getPollInterval();
    pollTimer = setInterval(checkInvites, interval);
    checkInvites();
  }

  /**
   * Stops the polling timer.
   */
  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  /**
   * Synchronizes the user's VRChat status based on Sleep Mode settings.
   */
  async function refreshStatus() {
    if (!sleepMode || !isReadyForApi()) return;

    const settings = getSettings();
    const isAutoStatusEnabled = !!settings.autoStatusEnabled;
    const hasStatusType =
      settings.sleepStatus && settings.sleepStatus !== "none";
    const targetDescription = settings.sleepStatusDescription?.trim() || "";

    if (isAutoStatusEnabled && (hasStatusType || targetDescription !== "")) {
      try {
        const user = await getCurrentUser();

        // Store original status before we modify it for the first time
        if (!preSleepStatus) {
          preSleepStatus = {
            status: user.status,
            statusDescription: user.statusDescription,
          };
        }

        const targetStatus = hasStatusType
          ? settings.sleepStatus
          : preSleepStatus.status;

        // Rate Limit Optimization: Only update if the status actually needs to change.
        if (
          user.status === targetStatus &&
          user.statusDescription === targetDescription
        ) {
          return;
        }

        const updatedUser = await updateStatus(
          user.id,
          targetStatus,
          targetDescription,
        );
        setSleepStatus = updatedUser.status;
        setSleepDescription = updatedUser.statusDescription;

        log(
          `Status updated to: ${setSleepStatus} (${setSleepDescription || "no message"})`,
        );
      } catch (error) {
        log(`Failed to update status: ${error.message}`);
      }
    } else if (preSleepStatus) {
      // Restoration Logic: If the feature is turned off while in Sleep Mode, restore pre-sleep state.
      try {
        const user = await getCurrentUser();
        log("Custom status cleared. Restoring pre-sleep status.");
        await updateStatus(
          user.id,
          preSleepStatus.status,
          preSleepStatus.statusDescription,
        );
        preSleepStatus = null;
        setSleepStatus = null;
        setSleepDescription = null;
      } catch (error) {
        log(`Failed to restore status: ${error.message}`);
      }
    }
  }

  /**
   * Activates Sleep Mode.
   */
  async function start() {
    try {
      sleepMode = true;
      startPolling();
      log("Sleep mode enabled.");
      await refreshStatus();
    } catch (error) {
      log(`Error: ${error.message}`);
    }
    return { sleepMode };
  }

  /**
   * Deactivates Sleep Mode and restores the user's original status.
   */
  async function stop() {
    try {
      sleepMode = false;
      stopPolling();
      log("Sleep mode disabled.");

      // Reset tracking sets for the next session
      handledInviteIds.clear();
      handledSenderIds.clear();

      if (preSleepStatus && isReadyForApi()) {
        try {
          const currentUserData = await getCurrentUser();

          // Safety Check: Only restore if the user hasn't manually changed their status in-game.
          // If the current status doesn't match what THIS app set it to, we assume
          // the user took manual control and we shouldn't overwrite their choice.
          const statusMatches = currentUserData.status === setSleepStatus;
          const descriptionMatches =
            currentUserData.statusDescription === setSleepDescription;

          if (statusMatches && descriptionMatches) {
            log(`Restoring pre-sleep status: ${preSleepStatus.status}`);
            await updateStatus(
              currentUserData.id,
              preSleepStatus.status,
              preSleepStatus.statusDescription,
            );
          } else {
            log("Status was changed manually in-game. Skipping restoration.");
          }
        } catch (error) {
          log(`Failed to restore status: ${error.message}`);
        } finally {
          preSleepStatus = null;
          setSleepStatus = null;
          setSleepDescription = null;
        }
      }
    } catch (error) {
      log(`Error stopping sleep mode: ${error.message}`);
    }
    return { sleepMode };
  }

  /**
   * Returns the current operational status of the engine.
   */
  function status() {
    return { sleepMode };
  }

  return {
    start,
    stop,
    status,
    refreshStatus,
  };
}

module.exports = {
  createSleepMode,
};
