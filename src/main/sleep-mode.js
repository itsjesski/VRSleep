function createSleepMode({
  getWhitelist,
  fetchInvites,
  sendInvite,
  deleteNotification,
  isReadyForApi,
  log,
  pollIntervalMs,
  minPollMs
}) {
  let sleepMode = false;
  let pollTimer = null;
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

  function start() {
    sleepMode = true;
    startPolling();
    log('Sleep mode enabled.');
    return { sleepMode };
  }

  function stop() {
    sleepMode = false;
    stopPolling();
    log('Sleep mode disabled.');
    return { sleepMode };
  }

  function status() {
    return { sleepMode };
  }

  return {
    start,
    stop,
    status
  };
}

module.exports = {
  createSleepMode
};
