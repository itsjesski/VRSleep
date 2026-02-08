const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const userHeader = document.getElementById('user-header');
const whitelistInput = document.getElementById('whitelist');
const toggleButton = document.getElementById('toggle');
const statusBadge = document.getElementById('status');
const logList = document.getElementById('log');
const userDisplayName = document.getElementById('user-display-name');
const authHint = document.getElementById('auth-hint');
const whitelistStatus = document.getElementById('whitelist-status');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login');
const logoutButton = document.getElementById('logout');
const updateButton = document.getElementById('update-btn');
const manageWhitelistButton = document.getElementById('manage-whitelist');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalHint = document.getElementById('modal-hint');
const modalCode = document.getElementById('modal-code');
const modalSubmit = document.getElementById('modal-submit');
const modalToggle = document.getElementById('modal-toggle');
const friendsModal = document.getElementById('friends-modal');
const friendsSearch = document.getElementById('friends-search');
const friendsList = document.getElementById('friends-list');
const friendsSave = document.getElementById('friends-save');
const friendsClose = document.getElementById('friends-close');
const tabWhitelist = document.getElementById('tab-whitelist');
const tabSettings = document.getElementById('tab-settings');
const tabActivity = document.getElementById('tab-activity');
const contentWhitelist = document.getElementById('content-whitelist');
const contentSettings = document.getElementById('content-settings');
const contentActivity = document.getElementById('content-activity');

const autoStatusBadge = document.getElementById('auto-status-badge');
const sleepStatus = document.getElementById('sleep-status');
const sleepStatusDescription = document.getElementById('sleep-status-description');

let twoFactorType = 'totp';
let twoFactorMethods = [];
let currentUser = null;
let whitelistDirty = false;
let saveTimer = null;
let settingsTimer = null;
let allFriends = [];
let selectedFriends = new Set();

function showView(view) {
  loginView.classList.remove('active');
  mainView.classList.remove('active');
  view.classList.add('active');
}

function setStatus(enabled) {
  statusBadge.textContent = enabled ? 'Enabled' : 'Disabled';
  statusBadge.className = enabled ? 'status on' : 'status off';
  toggleButton.textContent = enabled ? 'Disable Sleep Mode' : 'Enable Sleep Mode';
  toggleButton.className = enabled ? 'secondary' : 'primary';
}

function appendLog(message) {
  const item = document.createElement('div');
  item.className = 'log-item';
  const timestamp = new Date().toLocaleTimeString();
  item.textContent = `[${timestamp}] ${message}`;
  logList.prepend(item);
}

function setWhitelistStatus(text, state = 'saved') {
  whitelistStatus.textContent = text;
  whitelistStatus.className = `status ${state}`;
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
  try {
    const status = await window.sleepchat.getAuthStatus();
    if (status.authenticated) {
      const userResult = await window.sleepchat.getCurrentUser();
      if (userResult.ok && userResult.user) {
        setUserInfo(userResult.user);
      } else if (status.user) {
        setUserInfo(status.user);
      } else {
        setUserInfo({ id: status.userId, displayName: 'Loading...' });
      }
    } else {
      setUserInfo(null);
    }
  } catch (error) {
    console.error('Failed to refresh status:', error);
  }
}

async function loadWhitelist() {
  const list = await window.sleepchat.getWhitelist();
  whitelistInput.value = list.join('\n');
  whitelistDirty = false;
  setWhitelistStatus('Saved');
  if (list.length > 0) {
    appendLog(`Whitelist: ${list.join(', ')}`);
  }
}

function parseWhitelist(text) {
  return text
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function saveWhitelist() {
  const list = parseWhitelist(whitelistInput.value);
  await window.sleepchat.setWhitelist(list);
  whitelistDirty = false;
  setWhitelistStatus('Saved', 'saved');
  if (list.length > 0) {
    appendLog(`Whitelist: ${list.join(', ')}`);
  } else {
    appendLog('Whitelist cleared.');
  }
}

function scheduleAutoSave() {
  whitelistDirty = true;
  setWhitelistStatus('Unsaved', 'unsaved');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    setWhitelistStatus('Saving...', 'saving');
    await saveWhitelist();
  }, 1000);
}

whitelistInput.addEventListener('input', () => {
  scheduleAutoSave();
});

tabWhitelist.addEventListener('click', () => {
  tabWhitelist.classList.add('active');
  tabActivity.classList.remove('active');
  contentWhitelist.classList.add('active');
  contentActivity.classList.remove('active');
});

tabActivity.addEventListener('click', () => {
  tabActivity.classList.add('active');
  tabWhitelist.classList.remove('active');
  contentActivity.classList.add('active');
  contentWhitelist.classList.remove('active');
});

let isAutoStatusEnabled = false;

function updateAutoStatusUI(enabled) {
  isAutoStatusEnabled = enabled;
  autoStatusBadge.textContent = enabled ? 'Enabled' : 'Disabled';
  autoStatusBadge.className = enabled ? 'status on' : 'status off';
  autoStatusToggle.className = enabled ? 'secondary' : 'primary';
}

const STATUS_COLORS = {
  'none': '#9ca3af',
  'join me': '#42CAFF',
  'active': '#51E57E',
  'ask me': '#E8B138',
  'busy': '#C93131'
};

function updateAutoStatusUI() {
  const hasStatus = sleepStatus.value !== 'none';
  const hasMessage = sleepStatusDescription.value.trim() !== '';
  const enabled = hasStatus || hasMessage;
  
  autoStatusBadge.textContent = enabled ? 'Enabled' : 'Disabled';
  autoStatusBadge.className = enabled ? 'status on' : 'status off';
  
  // Update dropdown text color to match selected status
  sleepStatus.style.color = STATUS_COLORS[sleepStatus.value] || '#e3e5e8';
}

async function saveSettings() {
  const settings = {
    sleepStatus: sleepStatus.value,
    sleepStatusDescription: sleepStatusDescription.value
  };
  await window.sleepchat.setSettings(settings);
}

function scheduleSettingsSave() {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(async () => {
    await saveSettings();
  }, 1000);
}

sleepStatus.addEventListener('change', () => {
  updateAutoStatusUI();
  scheduleSettingsSave();
});

sleepStatusDescription.addEventListener('input', () => {
  updateAutoStatusUI();
  scheduleSettingsSave();
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

updateButton.addEventListener('click', async () => {
  await window.sleepchat.downloadUpdate();
});

manageWhitelistButton.addEventListener('click', async () => {
  appendLog('Loading friends list...');
  const result = await window.sleepchat.getFriends();
  
  if (!result.ok) {
    appendLog(`Failed to load friends: ${result.error}`);
    return;
  }
  
  allFriends = result.friends;
  
  // Parse current whitelist to pre-select friends
  const currentWhitelist = whitelistInput.value
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(Boolean);
  
  selectedFriends.clear();
  allFriends.forEach(friend => {
    const idMatch = currentWhitelist.includes(friend.id.toLowerCase());
    const nameMatch = currentWhitelist.includes(friend.displayName.toLowerCase());
    if (idMatch || nameMatch) {
      selectedFriends.add(friend.id);
    }
  });
  
  renderFriendsList(allFriends);
  friendsModal.classList.add('active');
});

friendsSearch.addEventListener('input', () => {
  const query = friendsSearch.value.toLowerCase();
  const filtered = allFriends.filter(friend => 
    friend.displayName.toLowerCase().includes(query) ||
    friend.id.toLowerCase().includes(query)
  );
  renderFriendsList(filtered);
});

friendsClose.addEventListener('click', () => {
  friendsModal.classList.remove('active');
  friendsSearch.value = '';
});

friendsSave.addEventListener('click', () => {
  // Build list from selected friends (use display names)
  const selectedNames = allFriends
    .filter(f => selectedFriends.has(f.id))
    .map(f => f.displayName);
  
  // Get existing whitelist entries
  const existingEntries = whitelistInput.value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  
  // Combine existing and new entries, removing duplicates (case-insensitive)
  const existingLower = existingEntries.map(e => e.toLowerCase());
  const newEntries = selectedNames.filter(name => 
    !existingLower.includes(name.toLowerCase())
  );
  
  // Append new entries to the end
  const combined = [...existingEntries, ...newEntries];
  
  whitelistInput.value = combined.join('\n');
  setWhitelistStatus('Saving...', 'saving');
  scheduleAutoSave();
  
  friendsModal.classList.remove('active');
  friendsSearch.value = '';
  
  if (newEntries.length > 0) {
    appendLog(`Added ${newEntries.length} new friend(s) to whitelist`);
  } else {
    appendLog('All selected friends already in whitelist');
  }
});

function renderFriendsList(friends) {
  friendsList.innerHTML = '';
  
  if (friends.length === 0) {
    friendsList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-muted);">No friends found</div>';
    return;
  }
  
  friends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'friend-item';
    if (selectedFriends.has(friend.id)) {
      item.classList.add('selected');
    }
    
    const avatar = document.createElement('img');
    avatar.className = 'friend-avatar';
    avatar.src = friend.thumbnailUrl || '';
    avatar.onerror = () => { avatar.style.display = 'none'; };
    
    const info = document.createElement('div');
    info.className = 'friend-info';
    
    const name = document.createElement('div');
    name.className = 'friend-name';
    name.textContent = friend.displayName;
    
    const status = document.createElement('div');
    status.className = 'friend-status';
    status.textContent = friend.statusDescription || friend.status;
    
    info.appendChild(name);
    info.appendChild(status);
    
    item.appendChild(avatar);
    item.appendChild(info);
    
    item.addEventListener('click', () => {
      if (selectedFriends.has(friend.id)) {
        selectedFriends.delete(friend.id);
        item.classList.remove('selected');
      } else {
        selectedFriends.add(friend.id);
        item.classList.add('selected');
      }
    });
    
    friendsList.appendChild(item);
  });
}

window.sleepchat.onLog((message) => appendLog(message));

window.sleepchat.onUpdateAvailable(() => {
  updateButton.style.display = 'block';
});

async function loadSettings() {
  const settings = await window.sleepchat.getSettings();
  sleepStatus.value = settings.sleepStatus || 'none';
  sleepStatusDescription.value = settings.sleepStatusDescription || '';
  updateAutoStatusUI();
}

(async () => {
  await loadWhitelist();
  await loadSettings();
  const status = await window.sleepchat.getStatus();
  setStatus(status.sleepMode);
  await refreshAuthStatus();
})();
