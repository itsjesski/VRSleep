window.VRSleepLayoutParts = window.VRSleepLayoutParts || {};

window.VRSleepLayoutParts.mainView = `
<div id="main-view" class="view">
  <div class="card">
    <div class="row space">
      <strong>Sleep Mode</strong>
      <div id="status" class="status off">Disabled</div>
    </div>
    <p class="hint">
      When enabled, VRSleep will automatically respond to invite
      requests from whitelisted users.
    </p>
    <button id="toggle" class="primary w-full">Enable Sleep Mode</button>
  </div>

  <div class="card tabs-container">
    <div class="tabs">
      <button id="tab-whitelist" class="tab active">Whitelist</button>
      <button id="tab-customizations" class="tab">Customizations</button>
      <button id="tab-activity" class="tab">Activity Log</button>
    </div>

    <div id="content-whitelist" class="tab-content active">
      <div class="whitelist-panel">
        <div id="whitelist-empty" class="whitelist-empty">No people in whitelist yet</div>
        <div id="whitelist-list" class="whitelist-list"></div>
      </div>
      <button id="manage-whitelist" class="secondary w-full">Add Person</button>
      <div id="whitelist-status" class="status error" style="display:none; margin-top:6px; text-transform:none; font-size:12px;"></div>
    </div>

    <div id="content-customizations" class="tab-content">
      <div class="section setting-box">
        <div class="row space">
          <strong class="flex-1">Custom Status</strong>
          <label class="switch">
            <input type="checkbox" id="auto-status-toggle" />
            <span class="slider"></span>
          </label>
        </div>
        <p class="hint">This status will be set when you enable sleep mode.</p>
        <div class="row">
          <div class="status-select-wrapper">
            <span id="sleep-status-dot" class="status-dot"></span>
            <select id="sleep-status" class="status-select">
              <option value="none" style="display:none">None</option>
              <option value="join me">Join Me</option>
              <option value="active">Active</option>
              <option value="ask me">Ask Me</option>
              <option value="busy">Busy</option>
            </select>
          </div>
          <input id="sleep-status-description" placeholder="Status message..." class="flex-1" maxlength="32" />
        </div>
        <div class="text-right">
          <span id="status-char-count" class="hint">0/32</span>
        </div>
      </div>

      <div class="section setting-box">
        <div class="row space">
          <strong class="flex-1">Invite Message</strong>
          <label class="switch">
            <input type="checkbox" id="invite-message-toggle" />
            <span class="slider"></span>
          </label>
        </div>
        <p class="hint">This message will be sent with your invite response.</p>
        <div class="section gap-sm">
          <div class="row space">
            <div class="row">
              <select id="invite-message-slot" class="slot-select">
                <option value="0">Slot 1</option>
                <option value="1">Slot 2</option>
                <option value="2">Slot 3</option>
                <option value="3">Slot 4</option>
                <option value="4">Slot 5</option>
                <option value="5">Slot 6</option>
                <option value="6">Slot 7</option>
                <option value="7">Slot 8</option>
                <option value="8">Slot 9</option>
                <option value="9">Slot 10</option>
                <option value="10">Slot 11</option>
                <option value="11">Slot 12</option>
              </select>
            </div>
            <button id="apply-slot" class="secondary btn-small" disabled>Apply</button>
          </div>
          <textarea id="invite-slot-preview" maxlength="64" class="msg-preview"></textarea>
          <div class="row space top">
            <span class="hint flex-1" style="color: #f87171">VRChat will lock the slot for 60 minutes on change.</span>
            <span id="invite-char-count" class="hint">0/64</span>
          </div>
        </div>
      </div>
    </div>

    <div id="content-activity" class="tab-content">
      <div class="log-panel">
        <div id="log-empty" class="log-empty">No events yet</div>
        <div class="log" id="log"></div>
      </div>
    </div>
  </div>
</div>
`;