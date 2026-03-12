window.VRSleepLayoutParts = window.VRSleepLayoutParts || {};

window.VRSleepLayoutParts.modals = `
<div id="modal" class="modal">
  <div class="modal-card">
    <strong id="modal-title">Two-factor verification</strong>
    <p class="hint" id="modal-hint">Enter your verification code.</p>
    <div>
      <label for="modal-code">Code</label>
      <input id="modal-code" autocomplete="one-time-code" />
    </div>
    <div class="row">
      <button id="modal-submit" class="flex-1">Verify</button>
      <button id="modal-toggle" class="secondary flex-1">Use backup code</button>
    </div>
  </div>
</div>

<div id="friends-modal" class="modal">
  <div class="modal-card friends-modal">
    <div class="row space">
      <strong>Add Friends to Whitelist</strong>
      <button id="friends-close" class="ghost btn-small">✕</button>
    </div>
    <input id="friends-search" placeholder="Search friends..." />
    <div id="friends-list" class="friends-list"></div>
    <button id="friends-save" class="primary w-full">Add Selected</button>
    <div class="modal-separator"></div>
    <strong>Add by Name or User ID</strong>
    <div class="manual-add-row">
      <input id="friends-manual-input" placeholder="Display name or user ID" />
      <button id="friends-manual-add" class="primary btn-small">Add</button>
    </div>
  </div>
</div>

<div id="session-expired-modal" class="modal">
  <div class="modal-card">
    <strong id="session-expired-title">Session expired</strong>
    <p class="hint" id="session-expired-message">Your VRChat session expired. Please log in again.</p>
    <button id="session-expired-ok" class="primary">OK</button>
  </div>
</div>
`;
