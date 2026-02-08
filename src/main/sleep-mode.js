function createSleepMode({
  getWhitelist,
  fetchInvites,
  sendInvite,
  deleteNotification,
  isReadyForApi,
  getCurrentUser,
  updateStatus,
  getSettings,
  log,
  pollIntervalMs,
  minPollMs
}) {
  let sleepMode = false;
  let pollTimer = null;
  let preSleepStatus = null;
  let setSleepStatus = null;
  let setSleepDescription = null;
  const handledInviteIds = new Set();
  const handledSenderIds = new Set(); // Track by sender to prevent multiple invites to same person

  function getPollInterval() {
    const raw = Number(pollIntervalMs);
    if (!Number.isFinite(raw)) return minPollMs;
    return Math.max(raw, minPollMs);
  }

  function normalizeEntry(entry) {
    return String(entry || '').trim().toLowerCase();
  }

  async function checkInvites() {
    if (!sleepMode) return;
    if (!isReadyForApi()) return;

    // Check for manual status change during sleep mode
    if (setSleepStatus !== null) {
      try {
        const user = await getCurrentUser();
        const statusChanged = user.status !== setSleepStatus || user.statusDescription !== setSleepDescription;
        if (statusChanged) {
          preSleepStatus = {
            status: user.status,
            statusDescription: user.statusDescription
          };
          setSleepStatus = user.status;
          setSleepDescription = user.statusDescription;
        }
      } catch (error) {
        // Silent fail for status check
      }
    }

    let invites;
    try {
      invites = await fetchInvites();
    } catch (error) {
      return;
    }

    if (!Array.isArray(invites) || invites.length === 0) return;

    const whitelist = getWhitelist().map(normalizeEntry).filter(Boolean);
    
    for (const invite of invites) {
      if (!invite) continue;
      const inviteId = invite.id || invite.notificationId || invite._id;
      
      const senderIdRaw = invite.senderId || invite.senderUserId || invite.userId;
      const senderIdNorm = normalizeEntry(senderIdRaw);
      const senderName = normalizeEntry(invite.senderDisplayName || invite.senderUsername || invite.displayName);
      const displayName = invite.senderDisplayName || invite.senderUsername || senderIdRaw;

      // Skip if we've already handled this sender in this session
      if (handledSenderIds.has(senderIdRaw)) {
        try {
          if (inviteId) await deleteNotification(inviteId);
        } catch (error) {
          // Silent fail
        }
        continue;
      }

      // Skip if we've already handled this specific notification
      if (inviteId && handledInviteIds.has(inviteId)) {
        continue;
      }
      
      const matches = whitelist.includes(senderIdNorm) || whitelist.includes(senderName);
      if (!matches) {
        try {
          if (inviteId) await deleteNotification(inviteId);
        } catch (error) {
          // Silent fail
        }
        continue;
      }

      try {
        await sendInvite(senderIdRaw, inviteId);
        handledSenderIds.add(senderIdRaw);
        if (inviteId) handledInviteIds.add(inviteId);
        log(`Sent invite to ${displayName}`);
        
        try {
          if (inviteId) await deleteNotification(inviteId);
        } catch (error) {
          // Silent fail
        }
      } catch (error) {
        log(`Failed to send invite to ${displayName}: ${error.message}`);
        try {
          if (inviteId) await deleteNotification(inviteId);
        } catch (delError) {
          // Silent fail
        }
      }
    }
  }

  function startPolling() {
    if (pollTimer) return;
    const interval = getPollInterval();
    pollTimer = setInterval(checkInvites, interval);
    checkInvites();
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  async function refreshStatus() {
    if (!sleepMode || !isReadyForApi()) return;

    const settings = getSettings();
    const hasStatusType = settings.sleepStatus && settings.sleepStatus !== 'none';
    const hasDescription = settings.sleepStatusDescription && settings.sleepStatusDescription.trim() !== '';

    // If we are turning ON any custom status feature, capture pre-sleep status if we haven't yet
    if (hasStatusType || hasDescription) {
      try {
        const user = await getCurrentUser();
        
        if (!preSleepStatus) {
          preSleepStatus = {
            status: user.status,
            statusDescription: user.statusDescription
          };
        }
        
        // Use custom values if provided, otherwise fall back to pre-sleep values
        const targetStatus = hasStatusType ? settings.sleepStatus : preSleepStatus.status;
        const targetDescription = hasDescription ? settings.sleepStatusDescription.trim() : preSleepStatus.statusDescription;
        
        const updatedUser = await updateStatus(user.id, targetStatus, targetDescription);
        
        setSleepStatus = updatedUser.status;
        setSleepDescription = updatedUser.statusDescription;
        
        log(`Status updated to: ${setSleepStatus} (${setSleepDescription || 'no message'})`);
      } catch (error) {
        log(`Failed to update status: ${error.message}`);
      }
    } else if (preSleepStatus) {
      // Both are 'None'/blank, so we revert everything back to original
      try {
        log('Custom status cleared. Restoring pre-sleep status.');
        const user = await getCurrentUser();
        await updateStatus(user.id, preSleepStatus.status, preSleepStatus.statusDescription);
        preSleepStatus = null;
        setSleepStatus = null;
        setSleepDescription = null;
      } catch (error) {
        log(`Failed to restore status: ${error.message}`);
      }
    }
  }

  async function start() {
    try {
      sleepMode = true;
      startPolling();
      log('Sleep mode enabled.');
      await refreshStatus();
    } catch (error) {
      log(`Error: ${error.message}`);
    }

    return { sleepMode };
  }

  async function stop() {
    try {
      sleepMode = false;
      stopPolling();
      log('Sleep mode disabled.');
      
      // Clear handled IDs so we can respond to the same people if we restart sleep mode
      handledInviteIds.clear();
      handledSenderIds.clear();

      if (preSleepStatus && isReadyForApi()) {
        try {
          const currentUserData = await getCurrentUser();
          
          // Only restore if the user hasn't manually changed their status in-game
          // We check if the current status matches what we set it to
          const statusMatches = currentUserData.status === setSleepStatus;
          const descriptionMatches = currentUserData.statusDescription === setSleepDescription;

          if (statusMatches && descriptionMatches) {
            log(`Restoring pre-sleep status: ${preSleepStatus.status}`);
            await updateStatus(currentUserData.id, preSleepStatus.status, preSleepStatus.statusDescription);
          } else {
            log('Status was changed manually in-game. Skipping restoration.');
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

  function status() {
    return { sleepMode };
  }

  return {
    start,
    stop,
    status,
    refreshStatus
  };
}

module.exports = {
  createSleepMode
};
