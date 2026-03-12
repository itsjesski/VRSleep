// --- Application State ---
const STATUS_COLORS = {
  none: "#9ca3af",
  "join me": "#42CAFF",
  active: "#51E57E",
  "ask me": "#E8B138",
  busy: "#C93131",
};

const UI_TEXT_FALLBACKS = Object.freeze({});

let uiText = {
  ...UI_TEXT_FALLBACKS,
};

function getUiText(key, fallback = "") {
  const value = uiText?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function formatUiText(key, replacements = {}, fallback = "") {
  const template = getUiText(key, fallback);
  return String(template).replace(/\{(\w+)\}/g, (_match, token) => {
    const value = replacements[token];
    return value === undefined || value === null ? "" : String(value);
  });
}

function getSessionExpiredTitle() {
  return getUiText("sessionExpiredTitle", UI_TEXT_FALLBACKS.sessionExpiredTitle || "");
}

function getSessionExpiredMessage() {
  return getUiText(
    "sessionExpiredMessage",
    UI_TEXT_FALLBACKS.sessionExpiredMessage || "",
  );
}

function getSessionExpiredLogText() {
  return getUiText("sessionExpiredLog", UI_TEXT_FALLBACKS.sessionExpiredLog || "");
}

let currentUser = null;
let twoFactorType = "totp";
let twoFactorMethods = [];
let allFriends = [];
let selectedFriends = new Set();
let whitelistEntries = [];
let cachedSlotsData = {
  message: [],
  response: [],
  request: [],
  requestResponse: [],
};
let slotCooldowns = {
  message: {},
  response: {},
  request: {},
  requestResponse: {},
};

// Cache timestamps
let friendsCacheTime = 0;
let slotsCacheTime = 0;

// Timers & Flags
let saveTimer = null;
let settingsTimer = null;
let autoStatusEnabled = false;
let inviteMessageEnabled = false;
let isApplying = false;
let handlingSessionExpiration = false;
