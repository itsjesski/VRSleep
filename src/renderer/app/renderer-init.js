/**
 * Renderer startup lifecycle.
 */

(async () => {
  await loadUiText();
  bindRendererEvents();
  startCustomizationTimers();
  updateLogEmptyState();
  startFriendStatusPolling();

  const isAuthenticated = await refreshAuthStatus();

  await Promise.all([
    loadCachedSlots(),
    loadWhitelist(),
    loadSettings(),
    loadCooldowns(),
  ]);

  window.sleepchat.getStatus().then((s) => setStatus(s.sleepMode));

  if (isAuthenticated) {
    await fetchSlots();
    await refreshFriendsCache();
  }
})();
