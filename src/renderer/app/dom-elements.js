// --- DOM Elements: Views & Headers ---
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const userHeader = document.getElementById("user-header");
const userDisplayName = document.getElementById("user-display-name");
const authHint = document.getElementById("auth-hint");

// --- DOM Elements: Whitelist & Logs ---
const whitelistList = document.getElementById("whitelist-list");
const whitelistEmpty = document.getElementById("whitelist-empty");
const whitelistStatus = document.getElementById("whitelist-status");
const manageWhitelistButton = document.getElementById("manage-whitelist");
const logList = document.getElementById("log");
const logEmpty = document.getElementById("log-empty");

// --- DOM Elements: Sleep Mode Controls ---
const statusBadge = document.getElementById("status");
const toggleButton = document.getElementById("toggle");
const autoStatusToggle = document.getElementById("auto-status-toggle");
const sleepStatus = document.getElementById("sleep-status");
const sleepStatusDot = document.getElementById("sleep-status-dot");
const sleepStatusDescription = document.getElementById(
  "sleep-status-description",
);

// --- DOM Elements: Customization Controls ---
const inviteMessageToggle = document.getElementById("invite-message-toggle");
const inviteMessageSlot = document.getElementById("invite-message-slot");
const inviteSlotPreview = document.getElementById("invite-slot-preview");
const applySlotButton = document.getElementById("apply-slot");
const statusCharCount = document.getElementById("status-char-count");
const inviteCharCount = document.getElementById("invite-char-count");

// --- DOM Elements: Modals & Tabs ---
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalHint = document.getElementById("modal-hint");
const modalCode = document.getElementById("modal-code");
const modalSubmit = document.getElementById("modal-submit");
const modalToggle = document.getElementById("modal-toggle");

const friendsModal = document.getElementById("friends-modal");
const friendsSearch = document.getElementById("friends-search");
const friendsList = document.getElementById("friends-list");
const friendsSave = document.getElementById("friends-save");
const friendsClose = document.getElementById("friends-close");
const friendsManualInput = document.getElementById("friends-manual-input");
const friendsManualAdd = document.getElementById("friends-manual-add");
const sessionExpiredModal = document.getElementById("session-expired-modal");
const sessionExpiredTitle = document.getElementById("session-expired-title");
const sessionExpiredMessage = document.getElementById("session-expired-message");
const sessionExpiredOk = document.getElementById("session-expired-ok");

const tabWhitelist = document.getElementById("tab-whitelist");
const tabCustomizations = document.getElementById("tab-customizations");
const tabActivity = document.getElementById("tab-activity");
const contentWhitelist = document.getElementById("content-whitelist");
const contentCustomizations = document.getElementById("content-customizations");
const contentActivity = document.getElementById("content-activity");

// --- DOM Elements: Utilities ---
const loginButton = document.getElementById("login");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const updateButton = document.getElementById("update-btn");
const userDropdown = document.getElementById("user-dropdown");
const dropdownViewLog = document.getElementById("dropdown-view-log");
const dropdownLogout = document.getElementById("dropdown-logout");
