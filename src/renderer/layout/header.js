window.VRSleepLayoutParts = window.VRSleepLayoutParts || {};

window.VRSleepLayoutParts.header = `
<div class="header">
  <h1>VRSleep</h1>
  <div id="user-header" class="user-header" style="display: none">
    <button id="update-btn" class="ghost" style="display: none">
      Update Available
    </button>
    <div class="user-menu">
      <span id="user-display-name" class="user-name">User</span>
      <div id="user-dropdown" class="dropdown-menu">
        <button class="dropdown-item" id="dropdown-view-log">View Log</button>
        <button class="dropdown-item danger" id="dropdown-logout">Logout</button>
      </div>
    </div>
  </div>
</div>
`;