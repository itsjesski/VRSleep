window.VRSleepLayoutParts = window.VRSleepLayoutParts || {};

window.VRSleepLayoutParts.loginView = `
<div id="login-view" class="view">
  <div class="card">
    <strong>Login to VRChat</strong>
    <div>
      <label for="username">Username or email</label>
      <input id="username" autocomplete="username" />
    </div>
    <div>
      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="current-password" />
    </div>
    <div class="row">
      <button id="login" class="primary">Login</button>
    </div>
    <div class="hint" id="auth-hint"></div>
  </div>
</div>
`;