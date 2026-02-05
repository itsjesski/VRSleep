const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const userHeader = document.getElementById('user-header');
const whitelistInput = document.getElementById('whitelist');
const saveButton = document.getElementById('save');
const toggleButton = document.getElementById('toggle');
const statusBadge = document.getElementById('status');
const logList = document.getElementById('log');
const userDisplayName = document.getElementById('user-display-name');
const authHint = document.getElementById('auth-hint');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login');
const logoutButton = document.getElementById('logout');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalHint = document.getElementById('modal-hint');
const modalCode = document.getElementById('modal-code');
const modalSubmit = document.getElementById('modal-submit');
const modalToggle = document.getElementById('modal-toggle');

let twoFactorType = 'totp';
let twoFactorMethods = [];
let currentUser = null;

function showView(view) {
  loginView.classList.remove('active');
  mainView.classList.remove('active');
  view.classList.add('active');
}

function setStatus(enabled) {
  statusBadge.textContent = enabled ? 'On' : 'Off';
  statusBadge.className = enabled ? 'status on' : 'status off';
  toggleButton.textContent = enabled ? 'Stop Sleep Mode' : 'Start Sleep Mode';
}

function appendLog(message) {
  const item = document.createElement('div');
  item.className = 'log-item';
  const timestamp = new Date().toLocaleTimeString();
  item.textContent = `[${timestamp}] ${message}`;
  logList.prepend(item);
}

function setAuthHint(message, isError = false) {
  authHint.textContent = message || '';
  authHint.style.color = isError ? '#f87171' : '#9ca3af';
}

function setUserInfo(user) {
  currentUser = user;
  if (user) {
    userDisplayName.textContent = user.displayName || user.username || 'User';
    userHeader.style.display = 'flex';
    showView(mainView);
  } else {
    userHeader.style.display = 'none';
    showView(loginView);
  }
}

function setModalState(visible) {
  if (visible) {
    modal.classList.add('active');
  } else {
    modal.classList.remove('active');
  }
}

function updateModalCopy() {
  if (twoFactorType === 'email') {
    modalTitle.textContent = 'Email verification';
    modalHint.textContent = 'Enter the 6-digit code sent to your email.';
    modalToggle.textContent = 'Use backup code';
  } else if (twoFactorType === 'otp') {
    modalTitle.textContent = 'Backup code';
    modalHint.textContent = 'Enter your recovery code (xxxx-xxxx).';
    modalToggle.textContent = twoFactorMethods.includes('emailOtp') ? 'Use email code' : 'Use authenticator';
  } else {
    modalTitle.textContent = 'Authenticator code';
    modalHint.textContent = 'Enter the 6-digit code from your authenticator app.';
    modalToggle.textContent = 'Use backup code';
  }
}

async function refreshAuthStatus() {
  const status = await window.sleepchat.getAuthStatus();
  if (status.authenticated && status.user) {
    setUserInfo(status.user);
  } else if (status.authenticated) {
    // Authenticated but no user data cached, show basic info
    setUserInfo({ id: status.userId, displayName: 'Loading...' });
  } else {
    setUserInfo(null);
  }
}

async function loadWhitelist() {
  const list = await window.sleepchat.getWhitelist();
  whitelistInput.value = list.join('\n');
}

function parseWhitelist(text) {
  return text
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

saveButton.addEventListener('click', async () => {
  const list = parseWhitelist(whitelistInput.value);
  await window.sleepchat.setWhitelist(list);
  appendLog(`Whitelist saved (${list.length}).`);
});

loginButton.addEventListener('click', async () => {
  setAuthHint('');
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    setAuthHint('Username and password required.', true);
    return;
  }

  loginButton.disabled = true;
  try {
    const result = await window.sleepchat.login(username, password);
    if (!result.ok) {
      setAuthHint(result.error || 'Login failed.', true);
      return;
    }

    if (result.result?.status === '2fa') {
      twoFactorMethods = result.result.methods || [];
      twoFactorType = twoFactorMethods.includes('emailOtp') ? 'email' : 'totp';
      updateModalCopy();
      modalCode.value = '';
      setModalState(true);
      setAuthHint('Two-factor required.');
    } else {
      passwordInput.value = '';
      if (result.result?.user) {
        setUserInfo(result.result.user);
      } else {
        await refreshAuthStatus();
      }
      setAuthHint('');
    }
  } catch (error) {
    setAuthHint(error.message, true);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  await window.sleepchat.logout();
  setAuthHint('');
  setUserInfo(null);
  usernameInput.value = '';
  passwordInput.value = '';
});

modalToggle.addEventListener('click', () => {
  if (twoFactorType === 'otp') {
    twoFactorType = twoFactorMethods.includes('emailOtp') ? 'email' : 'totp';
  } else {
    twoFactorType = 'otp';
  }
  updateModalCopy();
});

modalSubmit.addEventListener('click', async () => {
  const code = modalCode.value.trim();
  if (!code) return;
  modalSubmit.disabled = true;
  try {
    const result = await window.sleepchat.verifyTwoFactor(twoFactorType, code);
    if (!result.ok) {
      setAuthHint(result.error || 'Verification failed.', true);
      return;
    }
    setModalState(false);
    modalCode.value = '';
    passwordInput.value = '';
    if (result.user) {
      setUserInfo(result.user);
    } else {
      await refreshAuthStatus();
    }
    setAuthHint('');
  } catch (error) {
    setAuthHint(error.message, true);
  } finally {
    modalSubmit.disabled = false;
  }
});

toggleButton.addEventListener('click', async () => {
  const status = await window.sleepchat.getStatus();
  if (status.sleepMode) {
    await window.sleepchat.stopSleep();
    setStatus(false);
  } else {
    await window.sleepchat.startSleep();
    setStatus(true);
  }
});

window.sleepchat.onLog((message) => appendLog(message));

(async () => {
  await loadWhitelist();
  const status = await window.sleepchat.getStatus();
  setStatus(status.sleepMode);
  await refreshAuthStatus();
})();
